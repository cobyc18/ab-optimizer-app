import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import { useState } from "react";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";
import React from "react"; // Added missing import

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    console.log("Manage A/B Tests loader started");
    
    // Get all running A/B tests
    const tests = await prisma.aBTest.findMany({
      where: { status: "running" },
      select: {
        id: true,
        name: true,
        productId: true,
        templateA: true,
        templateB: true,
        trafficSplit: true,
        status: true,
        startDate: true,
        endDate: true,
        endResultType: true,
        impressionThreshold: true,
        conversionThreshold: true,
        winner: true
      },
      orderBy: { startDate: "desc" }
    });
    
    console.log("Found running tests:", tests.length);

    // Get URL parameters
    const url = new URL(request.url);
    const selectedTestId = url.searchParams.get("testId");

    let selectedTest = null;
    if (selectedTestId) {
      selectedTest = tests.find(test => test.id === selectedTestId);
    }

    return json({
      tests,
      selectedTest,
      selectedTestId
    });
  } catch (error) {
    console.error("Error in Manage A/B Tests loader:", error);
    return json({
      tests: [],
      selectedTest: null,
      selectedTestId: null,
      error: error.message
    });
  }
};

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const actionType = formData.get("actionType");

    if (actionType === "updateTrafficSplit") {
      const testId = formData.get("testId");
      const trafficSplit = parseInt(formData.get("trafficSplit"));

      if (!testId || trafficSplit < 0 || trafficSplit > 100) {
        return json({ 
          success: false, 
          error: "Invalid traffic split value. Must be between 0 and 100." 
        });
      }

      // Update the traffic split in the database
      await prisma.aBTest.update({
        where: { id: testId },
        data: { trafficSplit }
      });

      return json({ 
        success: true, 
        message: "Traffic split updated successfully!",
        trafficSplit 
      });
    }

    if (actionType === "updateTestConfiguration") {
      const testId = formData.get("testId");
      const trafficSplit = parseInt(formData.get("trafficSplit"));
      const endResultType = formData.get("endResultType");
      const endDate = formData.get("endDate");
      const impressionThreshold = formData.get("impressionThreshold") ? parseInt(formData.get("impressionThreshold")) : null;
      const conversionThreshold = formData.get("conversionThreshold") ? parseInt(formData.get("conversionThreshold")) : null;

      if (!testId) {
        return json({ 
          success: false, 
          error: "Test ID is required" 
        });
      }

      if (trafficSplit < 0 || trafficSplit > 100) {
        return json({ 
          success: false, 
          error: "Invalid traffic split value. Must be between 0 and 100." 
        });
      }

      // Validate end result configuration based on type
      if (endResultType === "date" && !endDate) {
        return json({ 
          success: false, 
          error: "End date is required when end result type is 'date'" 
        });
      }

      if (endResultType === "impressions" && (!impressionThreshold || impressionThreshold < 100)) {
        return json({ 
          success: false, 
          error: "Impression threshold is required and must be at least 100 when end result type is 'impressions'" 
        });
      }

      if (endResultType === "conversions" && (!conversionThreshold || conversionThreshold < 10)) {
        return json({ 
          success: false, 
          error: "Conversion threshold is required and must be at least 10 when end result type is 'conversions'" 
        });
      }

      // Prepare update data
      const updateData = {
        trafficSplit,
        endResultType,
        impressionThreshold,
        conversionThreshold
      };

      // Add endDate only if it's provided and not empty
      if (endDate && endDate.trim() !== "") {
        updateData.endDate = new Date(endDate);
      } else if (endResultType !== "date") {
        updateData.endDate = null;
      }

      // Update the test configuration in the database
      await prisma.aBTest.update({
        where: { id: testId },
        data: updateData
      });

      return json({ 
        success: true, 
        message: "Changes saved successfully!",
        trafficSplit,
        endResultType,
        endDate,
        impressionThreshold,
        conversionThreshold
      });
    }

    if (actionType === "deleteTest") {
      const testId = formData.get("testId");

      if (!testId) {
        return json({ 
          success: false, 
          error: "Test ID is required" 
        });
      }

      // Get test info before deletion for confirmation message
      const testToDelete = await prisma.aBTest.findUnique({
        where: { id: testId }
      });

      if (!testToDelete) {
        return json({ 
          success: false, 
          error: "Test not found" 
        });
      }

      // Delete all associated events first (due to foreign key constraint)
      await prisma.aBEvent.deleteMany({
        where: { testId: testId }
      });

      // Clear the product metafield before deleting the test
      try {
        let productGid = testToDelete.productId;
        if (!productGid.startsWith('gid://')) {
          const numericId = productGid.match(/Product\/(\d+)/)?.[1] || productGid.match(/^(\d+)$/)?.[1] || productGid;
          productGid = `gid://shopify/Product/${numericId}`;
        }

        const metafieldMutation = `
          mutation productUpdateMetafield($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields {
                id
                namespace
                key
                value
              }
              userErrors {
                field
                message
              }
            }
          }
        `;
        
        const metafieldResponse = await admin.graphql(metafieldMutation, {
          variables: {
            metafields: [
              {
                ownerId: productGid,
                namespace: "ab_optimizer",
                key: "test_running",
                type: "boolean",
                value: "false"
              }
            ]
          }
        });
        
        const metafieldResult = await metafieldResponse.json();
        if (metafieldResult.data?.metafieldsSet?.userErrors?.length > 0) {
          console.error("⚠️ Metafield user errors when clearing:", metafieldResult.data.metafieldsSet.userErrors);
        } else {
          console.log("✅ Cleared product metafield: ab_optimizer.test_running = false (test deleted)");
        }
      } catch (metafieldError) {
        console.error("⚠️ Failed to clear metafield when deleting test:", metafieldError);
        // Don't fail the deletion if metafield clearing fails
      }

      // Delete the test
      await prisma.aBTest.delete({
        where: { id: testId }
      });

      return json({ 
        success: true, 
        message: `Test "${testToDelete.name}" has been deleted successfully!`,
        deletedTestName: testToDelete.name
      });
    }

    return json({ success: false, error: "Invalid action" });
  } catch (error) {
    console.error("Error in Manage A/B Tests action:", error);
    return json({ 
      success: false, 
      error: error.message 
    });
  }
};

export default function ManageABTests() {
  const { tests, selectedTest, selectedTestId, error } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const [selectedTestState, setSelectedTestState] = useState(selectedTestId || "");
  const [trafficSplit, setTrafficSplit] = useState(selectedTest?.trafficSplit || 50);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // End result configuration state
  const [endResultType, setEndResultType] = useState(selectedTest?.endResultType || "manual");
  const [endDate, setEndDate] = useState(selectedTest?.endDate ? new Date(selectedTest.endDate).toISOString().slice(0, 16) : "");
  const [impressionThreshold, setImpressionThreshold] = useState(selectedTest?.impressionThreshold?.toString() || "1000");
  const [conversionThreshold, setConversionThreshold] = useState(selectedTest?.conversionThreshold?.toString() || "100");
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [testToDelete, setTestToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Update form fields when selectedTest changes
  React.useEffect(() => {
    if (selectedTest) {
      setTrafficSplit(selectedTest.trafficSplit || 50);
      setEndResultType(selectedTest.endResultType || "manual");
      setEndDate(selectedTest.endDate ? new Date(selectedTest.endDate).toISOString().slice(0, 16) : "");
      setImpressionThreshold(selectedTest.impressionThreshold?.toString() || "1000");
      setConversionThreshold(selectedTest.conversionThreshold?.toString() || "100");
    }
  }, [selectedTest]);

  // Reset fields when end result type changes
  const handleEndResultTypeChange = (newType) => {
    setEndResultType(newType);
    // Reset fields based on new type
    if (newType === "date") {
      setEndDate("");
      setImpressionThreshold("1000");
      setConversionThreshold("100");
    } else if (newType === "impressions") {
      setEndDate("");
      setImpressionThreshold("1000");
      setConversionThreshold("100");
    } else if (newType === "conversions") {
      setEndDate("");
      setImpressionThreshold("1000");
      setConversionThreshold("100");
    } else if (newType === "manual") {
      setEndDate("");
      setImpressionThreshold("1000");
      setConversionThreshold("100");
    }
  };

  const handleTestChange = (testId) => {
    setSelectedTestState(testId);
    if (testId) {
      submit({ testId }, { method: "get" });
    }
  };

  const handleSaveConfiguration = async () => {
    if (!selectedTest) return;
    
    setIsSaving(true);
    submit(
      { 
        actionType: "updateTestConfiguration", 
        testId: selectedTest.id, 
        trafficSplit: trafficSplit.toString(),
        endResultType,
        endDate,
        impressionThreshold,
        conversionThreshold
      }, 
      { method: "post" }
    );
    setIsSaving(false);
  };

  const handleDeleteClick = (test) => {
    setTestToDelete(test);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!testToDelete) return;
    
    setIsDeleting(true);
    submit(
      { 
        actionType: "deleteTest", 
        testId: testToDelete.id
      }, 
      { method: "post" }
    );
    setIsDeleting(false);
    setShowDeleteConfirm(false);
    setTestToDelete(null);
    
    // Reset form if the deleted test was selected
    if (selectedTestState === testToDelete.id) {
      setSelectedTestState("");
      setTrafficSplit(50);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setTestToDelete(null);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  console.log("ManageABTests component rendered", { tests, selectedTest, selectedTestId });

  return (
    <div style={{ padding: '20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #32cd32 100%)',
        color: 'white',
        padding: '32px',
        borderRadius: '16px',
        marginBottom: '32px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
      }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>⚙️ Manage A/B Tests</h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>Edit and configure your running experiments</p>
      </div>

      {/* Test Selection */}
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '16px',
        marginBottom: '32px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid rgba(50, 205, 50, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#000000' }}>Select Test to Manage</h2>
          <div style={{
            background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            {tests.length} Running Tests
          </div>
        </div>
        <select
          value={selectedTestState}
          onChange={(e) => handleTestChange(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            background: 'white'
          }}
        >
          <option value="">Choose a test to manage...</option>
          {tests.map((test) => (
            <option key={test.id} value={test.id}>{test.name}</option>
          ))}
        </select>
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
          Select an A/B test to view details and edit settings
        </p>
      </div>

      {/* Test Details */}
      {selectedTest && (
        <div style={{
          background: 'white',
          padding: '24px',
          borderRadius: '16px',
          marginBottom: '32px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(50, 205, 50, 0.2)'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#000000', marginBottom: '24px' }}>
            Test Details: {selectedTest.name}
          </h2>

          {/* Test Information */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            <div style={{
              padding: '16px',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Status</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#32cd32' }}>
                {selectedTest.status.charAt(0).toUpperCase() + selectedTest.status.slice(1)}
              </div>
            </div>

            <div style={{
              padding: '16px',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Started</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#000000' }}>
                {formatDate(selectedTest.startDate)}
              </div>
            </div>

            <div style={{
              padding: '16px',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Product ID</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#000000' }}>
                {selectedTest.productId}
              </div>
            </div>

            <div style={{
              padding: '16px',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Current Traffic Split</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#32cd32' }}>
                {selectedTest.trafficSplit}% / {100 - selectedTest.trafficSplit}%
              </div>
            </div>
          </div>

          {/* Template Information */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#000000', marginBottom: '16px' }}>Template Configuration</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div style={{
                padding: '16px',
                background: '#f0fdf4',
                borderRadius: '8px',
                border: '1px solid #bbf7d0'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#166534', marginBottom: '8px' }}>Template A (Control)</div>
                <div style={{ fontSize: '12px', color: '#15803d', fontFamily: 'monospace' }}>
                  {selectedTest.templateA}
                </div>
              </div>
              <div style={{
                padding: '16px',
                background: '#fef3c7',
                borderRadius: '8px',
                border: '1px solid #fde68a'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>Template B (Variant)</div>
                <div style={{ fontSize: '12px', color: '#a16207', fontFamily: 'monospace' }}>
                  {selectedTest.templateB}
                </div>
              </div>
            </div>
          </div>

          {/* Traffic Split Editor */}
          <div style={{
            padding: '24px',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#000000', marginBottom: '16px' }}>Edit Traffic Split</h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
              Adjust the percentage of traffic that sees each variant. Changes take effect immediately.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', minWidth: '120px' }}>
                Traffic Split:
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={trafficSplit}
                onChange={(e) => setTrafficSplit(parseInt(e.target.value))}
                style={{
                  flex: 1,
                  height: '6px',
                  background: '#e5e7eb',
                  borderRadius: '3px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
              <div style={{
                background: 'white',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                fontWeight: '600',
                color: '#000000',
                minWidth: '60px',
                textAlign: 'center'
              }}>
                {trafficSplit}%
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#166534', marginBottom: '4px' }}>
                  Template A (Control)
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#166534' }}>
                  {trafficSplit}%
                </div>
              </div>
              <div style={{ fontSize: '20px', color: '#6b7280' }}>vs</div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
                  Template B (Variant)
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#92400e' }}>
                  {100 - trafficSplit}%
                </div>
              </div>
            </div>
          </div>

          {/* End Result Configuration Editor */}
          <div style={{
            padding: '24px',
            background: '#f0f9ff',
            borderRadius: '12px',
            border: '1px solid #bae6fd',
            marginBottom: '24px'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#000000', marginBottom: '16px' }}>🎯 Edit End Result Configuration</h3>
            <p style={{ fontSize: '14px', color: '#0369a1', marginBottom: '24px' }}>
              Configure how the test will determine a winner and when it should end.
            </p>

            {/* End Result Type Selection */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000000', marginBottom: '12px' }}>
                End Result Type <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="endResultType"
                    value="date"
                    checked={endResultType === "date"}
                    onChange={(e) => handleEndResultTypeChange(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', color: '#374151' }}>📅 End Date - Test ends on a specific date</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="endResultType"
                    value="impressions"
                    checked={endResultType === "impressions"}
                    onChange={(e) => handleEndResultTypeChange(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', color: '#374151' }}>👁️ Impression Count - Test ends when one variant reaches X impressions</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="endResultType"
                    value="conversions"
                    checked={endResultType === "conversions"}
                    onChange={(e) => handleEndResultTypeChange(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', color: '#374151' }}>💰 Conversion Rate - Test ends when one variant reaches X conversions</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="endResultType"
                    value="manual"
                    checked={endResultType === "manual"}
                    onChange={(e) => handleEndResultTypeChange(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', color: '#374151' }}>👤 Manual Control - You decide when to end the test</span>
                </label>
              </div>
            </div>

            {/* Conditional Fields Based on End Result Type */}
            {endResultType === 'date' && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000000', marginBottom: '8px' }}>
                  End Date & Time <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  The test will automatically end and determine a winner on this date
                </p>
              </div>
            )}

            {endResultType === 'impressions' && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000000', marginBottom: '8px' }}>
                  Impression Threshold <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="number"
                  value={impressionThreshold}
                  onChange={(e) => setImpressionThreshold(e.target.value)}
                  min="100"
                  placeholder="1000"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  Number of impressions needed for one variant to win (minimum 100)
                </p>
              </div>
            )}

            {endResultType === 'conversions' && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#000000', marginBottom: '8px' }}>
                  Conversion Threshold <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="number"
                  value={conversionThreshold}
                  onChange={(e) => setConversionThreshold(e.target.value)}
                  min="10"
                  placeholder="100"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  Number of conversions needed for one variant to win (minimum 10)
                </p>
              </div>
            )}

            {/* Save Configuration Button */}
            <button
              onClick={handleSaveConfiguration}
              disabled={isSaving}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                padding: '16px 32px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                opacity: isSaving ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!isSaving) {
                  e.target.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)';
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSaving) {
                  e.target.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                }
              }}
            >
              {isSaving ? '🔄 Saving...' : '💾 Save Changes'}
            </button>

            {/* Success/Error Messages */}
            {actionData && (
              <div style={{
                padding: '16px',
                borderRadius: '8px',
                marginTop: '16px',
                background: actionData.success 
                  ? 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)' 
                  : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: 'white',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                {actionData.success ? '✅ ' : '❌ '}
                {actionData.message || actionData.error}
              </div>
            )}
          </div>

          {/* Delete Test Section */}
          <div style={{
            padding: '24px',
            background: '#fef2f2',
            borderRadius: '12px',
            border: '1px solid #fecaca'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#dc2626', marginBottom: '16px' }}>⚠️ Delete Test</h3>
            <p style={{ fontSize: '14px', color: '#991b1b', marginBottom: '24px' }}>
              This action cannot be undone. Deleting this test will permanently remove all test data and analytics.
            </p>
            
            <button
              onClick={() => handleDeleteClick(selectedTest)}
              style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
              }}
            >
              🗑️ Delete Test
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
          color: 'white',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px'
        }}>
          <p>Error Loading Tests: {error}</p>
        </div>
      )}

      {/* No Test Selected */}
      {!selectedTest && !error && (
        <div style={{
          background: 'white',
          padding: '48px 24px',
          borderRadius: '16px',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(50, 205, 50, 0.2)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚙️</div>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#000000', marginBottom: '8px' }}>No Test Selected</h2>
          <p style={{ fontSize: '16px', color: '#6b7280' }}>
            Please select an A/B test from the dropdown above to manage its settings.
          </p>
        </div>
      )}

      {/* No Tests Available */}
      {!error && tests.length === 0 && (
        <div style={{
          background: 'white',
          padding: '48px 24px',
          borderRadius: '16px',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(50, 205, 50, 0.2)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#000000', marginBottom: '8px' }}>No Running Tests</h2>
          <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '24px' }}>
            You don't have any running A/B tests. Create a test to start managing experiments.
          </p>
          <button
            onClick={() => window.location.href = '/app/ab-tests'}
            style={{
              background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #228b22 0%, #006400 100%)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)';
            }}
          >
            Create Your First Test
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '32px',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
              <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#000000', marginBottom: '8px' }}>
                Delete A/B Test
              </h2>
              <p style={{ fontSize: '16px', color: '#6b7280' }}>
                Are you sure you want to delete <strong>"{testToDelete?.name}"</strong>?
              </p>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                padding: '16px',
                background: '#fef2f2',
                borderRadius: '8px',
                border: '1px solid #fecaca'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#dc2626', marginBottom: '8px' }}>
                  This action will permanently:
                </h3>
                <ul style={{ fontSize: '14px', color: '#991b1b', margin: 0, paddingLeft: '20px' }}>
                  <li>Delete all test data and analytics</li>
                  <li>Remove all associated events and metrics</li>
                  <li>Cannot be undone</li>
                </ul>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                style={{
                  padding: '12px 24px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isDeleting ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isDeleting) {
                    e.target.style.background = '#e5e7eb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDeleting) {
                    e.target.style.background = '#f3f4f6';
                  }
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                style={{
                  padding: '12px 24px',
                  background: isDeleting 
                    ? '#9ca3af' 
                    : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isDeleting) {
                    e.target.style.background = 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDeleting) {
                    e.target.style.background = isDeleting 
                      ? '#9ca3af' 
                      : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                  }
                }}
              >
                {isDeleting ? '🔄 Deleting...' : 'Yes, Delete Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
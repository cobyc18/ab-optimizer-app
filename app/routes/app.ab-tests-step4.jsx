import React from 'react';

export default function Step4({
  selectedIdea,
  wizardSelectedProductSnapshot,
  selectedProduct,
  wizardTestName,
  setWizardTestName,
  isEditingTestName,
  setIsEditingTestName,
  trafficSplitA,
  setTrafficSplitA,
  trafficSplitB,
  setTrafficSplitB,
  manualMode,
  setManualMode,
  autopilotOn,
  setAutopilotOn,
  fastMode,
  setFastMode,
  standardMode,
  setStandardMode,
  carefulMode,
  setCarefulMode,
  showFastTooltip,
  setShowFastTooltip,
  showStandardTooltip,
  setShowStandardTooltip,
  showCarefulTooltip,
  setShowCarefulTooltip,
  endOnDate,
  setEndOnDate,
  wizardLaunchError,
  setWizardLaunchError,
  wizardLaunchSuccess,
  isLaunchingTest,
  canLaunchTest,
  handleLaunchTest
}) {
  return (
    <div style={{
      animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      transform: 'translateX(0)',
      opacity: 1
    }}>
      <h3 style={{
        fontSize: '36px',
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: '32px'
      }}>
        Review & launch
      </h3>

      {/* Main White Card Container */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        padding: '40px',
        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)',
        marginBottom: '32px'
      }}>
        {/* Test Summary Section */}
        <div style={{ marginBottom: '40px', paddingBottom: '32px', borderBottom: '1px solid #E5E7EB' }}>
          <h4 style={{
            fontSize: '32px',
            fontWeight: '600',
            color: '#3B82F6',
            marginBottom: '16px'
          }}>
            Test Summary
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '20px'
          }}>
            {/* Product Name Card */}
            <div style={{
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '32px',
              borderTop: '3px solid #e6e6e6',
              minHeight: '180px',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'
            }}>
              <label style={{
                display: 'block',
                fontSize: '18px',
                fontWeight: '500',
                color: '#6B7280',
                marginBottom: '12px'
              }}>
                Product Name
              </label>
              <p style={{
                fontSize: '22px',
                fontWeight: '600',
                color: '#1F2937',
                margin: 0,
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                flex: 1
              }}>
                {wizardSelectedProductSnapshot?.title || selectedProduct?.title || 'Not selected'}
              </p>
            </div>

            {/* Widget Name Card */}
            <div style={{
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '32px',
              borderTop: '3px solid #e6e6e6',
              minHeight: '180px',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'
            }}>
              <label style={{
                display: 'block',
                fontSize: '18px',
                fontWeight: '500',
                color: '#6B7280',
                marginBottom: '12px'
              }}>
                Widget Name
              </label>
              <p style={{
                fontSize: '22px',
                fontWeight: '600',
                color: '#1F2937',
                margin: 0,
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                flex: 1
              }}>
                {selectedIdea?.utility || 'Not selected'}
              </p>
            </div>

            {/* Test Name Card */}
            <div style={{
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '32px',
              borderTop: '3px solid #ef9362',
              minHeight: '180px',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'
            }}>
              <label style={{
                display: 'block',
                fontSize: '18px',
                fontWeight: '500',
                color: '#6B7280',
                marginBottom: '12px'
              }}>
                Test Name
              </label>
              {isEditingTestName ? (
                <input
                  type="text"
                  value={wizardTestName}
                  onChange={(e) => setWizardTestName(e.target.value)}
                  onBlur={() => setIsEditingTestName(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingTestName(false);
                    }
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    border: '1px solid #3B82F6',
                    borderRadius: '4px',
                    fontSize: '22px',
                    fontWeight: '600',
                    color: '#1F2937',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              ) : (
                <p
                  onClick={() => setIsEditingTestName(true)}
                  style={{
                    fontSize: '22px',
                    fontWeight: '600',
                    color: '#1F2937',
                    margin: 0,
                    cursor: 'text',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    flex: 1
                  }}
                >
                  {wizardTestName || (selectedIdea && (wizardSelectedProductSnapshot || selectedProduct) 
                    ? `${selectedIdea.utility || 'Widget'} on ${wizardSelectedProductSnapshot?.title || selectedProduct?.title || 'Product'}`
                    : 'Test Name')}
                </p>
              )}
            </div>

            {/* Traffic Split Card */}
            <div style={{
              background: manualMode ? '#E0F2FE' : '#F9FAFB',
              border: manualMode ? '1px solid #3B82F6' : '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '32px',
              transition: 'all 0.2s ease',
              minHeight: '180px',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'
            }}>
              <label style={{
                display: 'block',
                fontSize: '18px',
                fontWeight: '500',
                color: '#6B7280',
                marginBottom: '12px'
              }}>
                Traffic Split
              </label>
              {manualMode ? (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={trafficSplitA}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setTrafficSplitA(Math.min(100, Math.max(0, val)));
                      setTrafficSplitB(100 - Math.min(100, Math.max(0, val)));
                    }}
                    style={{
                      width: '80px',
                      padding: '8px 12px',
                      border: '1px solid #3B82F6',
                      borderRadius: '6px',
                      fontSize: '22px',
                      fontWeight: '600',
                      color: '#1F2937',
                      outline: 'none',
                      background: '#FFFFFF'
                    }}
                  />
                  <span style={{ fontSize: '22px', fontWeight: '600', color: '#3B82F6' }}>-</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={trafficSplitB}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setTrafficSplitB(Math.min(100, Math.max(0, val)));
                      setTrafficSplitA(100 - Math.min(100, Math.max(0, val)));
                    }}
                    style={{
                      width: '80px',
                      padding: '8px 12px',
                      border: '1px solid #3B82F6',
                      borderRadius: '6px',
                      fontSize: '22px',
                      fontWeight: '600',
                      color: '#1F2937',
                      outline: 'none',
                      background: '#FFFFFF'
                    }}
                  />
                </div>
              ) : (
                <p style={{
                  fontSize: '22px',
                  fontWeight: '600',
                  color: '#1F2937',
                  margin: 0,
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  {trafficSplitA} - {trafficSplitB}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Variants Section */}
        <div style={{ marginBottom: '40px', paddingBottom: '32px', borderBottom: '1px solid #E5E7EB' }}>
          <h4 style={{
            fontSize: '32px',
            fontWeight: '600',
            color: '#3B82F6',
            marginBottom: '16px'
          }}>
            Variants
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '20px'
          }}>
            {/* Control Card */}
            <div style={{
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '32px',
              borderLeft: '4px solid #e6e6e6',
              minHeight: '180px',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'
            }}>
              <h5 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#374151',
                margin: '0 0 12px 0'
              }}>
                Control
              </h5>
              <p style={{
                fontSize: '18px',
                color: '#6B7280',
                margin: 0,
                lineHeight: '1.5',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                flex: 1
              }}>
                Product Selected before widget
              </p>
            </div>

            {/* Variant Card */}
            <div style={{
              background: '#E0F2FE',
              border: '1px solid #3B82F6',
              borderRadius: '12px',
              padding: '32px',
              borderLeft: '4px solid #3B82F6',
              minHeight: '180px',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'
            }}>
              <h5 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#3B82F6',
                margin: '0 0 12px 0'
              }}>
                Variant
              </h5>
              <p style={{
                fontSize: '18px',
                color: '#1E40AF',
                margin: 0,
                lineHeight: '1.5',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                flex: 1
              }}>
                Product Selected with widget added
              </p>
            </div>
          </div>
        </div>

        {/* AutoPilot Mode and Manual Mode */}
        <div style={{ marginBottom: '0' }}>
          {/* Autopilot Mode Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            paddingBottom: '16px',
            borderBottom: '1px solid #E5E7EB'
          }}>
            <div>
              <label style={{
                fontSize: '16px',
                fontWeight: '600',
                color: autopilotOn ? '#3B82F6' : '#1F2937',
                marginBottom: '4px',
                display: 'block',
                transition: 'color 0.2s ease'
              }}>
                Autopilot Mode
              </label>
              <p style={{
                fontSize: '12px',
                color: '#6B7280',
                margin: 0
              }}>
                Automatically declares a winner when the selected confidence threshold is reached
              </p>
            </div>
            <label style={{
              position: 'relative',
              display: 'inline-block',
              width: '48px',
              height: '24px'
            }}>
              <input
                type="checkbox"
                checked={autopilotOn}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setAutopilotOn(newValue);
                  // If autopilot is turned on, manual mode must be off
                  if (newValue) {
                    setManualMode(false);
                    // Reset mode selections when switching back to autopilot
                    setFastMode(false);
                    setStandardMode(false);
                    setCarefulMode(false);
                  } else {
                    // If autopilot is turned off, manual mode must be on (mutually exclusive)
                    setManualMode(true);
                  }
                }}
                style={{
                  opacity: 0,
                  width: 0,
                  height: 0
                }}
              />
              <span style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: autopilotOn ? '#3B82F6' : '#D1D5DB',
                borderRadius: '24px',
                transition: '0.3s',
                display: 'flex',
                alignItems: 'center',
                padding: '2px'
              }}>
                <span style={{
                  content: '""',
                  position: 'absolute',
                  height: '20px',
                  width: '20px',
                  left: autopilotOn ? '26px' : '2px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '50%',
                  transition: '0.3s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </span>
            </label>
          </div>

          {/* Mode Selection - Only shown when Autopilot is ON */}
          {autopilotOn && (
            <div style={{
              marginLeft: '24px',
              marginTop: '16px',
              paddingLeft: '24px',
              borderLeft: '3px solid #3B82F6',
              background: '#F0F9FF',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <p style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#1F2937',
                marginBottom: '16px'
              }}>
                Select Analysis Mode:
              </p>
              
              {/* Fast Mode */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                padding: '12px',
                background: fastMode ? '#E0F2FE' : '#FFFFFF',
                border: fastMode ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                borderRadius: '8px',
                transition: 'all 0.2s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <label style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: '40px',
                    height: '20px',
                    flexShrink: 0
                  }}>
                    <input
                      type="checkbox"
                      checked={fastMode}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        setFastMode(newValue);
                        if (newValue) {
                          setStandardMode(false);
                          setCarefulMode(false);
                        }
                      }}
                      style={{
                        opacity: 0,
                        width: 0,
                        height: 0
                      }}
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: fastMode ? '#3B82F6' : '#D1D5DB',
                      borderRadius: '20px',
                      transition: '0.3s',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px'
                    }}>
                      <span style={{
                        content: '""',
                        position: 'absolute',
                        height: '16px',
                        width: '16px',
                        left: fastMode ? '22px' : '2px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '50%',
                        transition: '0.3s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </span>
                  </label>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: fastMode ? '#3B82F6' : '#1F2937'
                      }}>
                        Fast Mode
                      </span>
                      <div 
                        style={{
                          position: 'relative',
                          display: 'inline-block',
                          cursor: 'help'
                        }}
                        onMouseEnter={() => setShowFastTooltip(true)}
                        onMouseLeave={() => setShowFastTooltip(false)}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: '#6B7280' }}>
                          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                          <text x="8" y="11" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="bold">?</text>
                        </svg>
                        {showFastTooltip && (
                          <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginBottom: '8px',
                            padding: '8px 12px',
                            background: '#1F2937',
                            color: '#FFFFFF',
                            borderRadius: '6px',
                            fontSize: '12px',
                            zIndex: 1000,
                            width: '200px',
                            whiteSpace: 'normal',
                            textAlign: 'left',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }}>
                            <strong>Fast Mode (55% probability)</strong><br/>
                            Quick decisions with lower confidence. Best for rapid iteration and early insights.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Standard Mode */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                padding: '12px',
                background: standardMode ? '#E0F2FE' : '#FFFFFF',
                border: standardMode ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                borderRadius: '8px',
                transition: 'all 0.2s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <label style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: '40px',
                    height: '20px',
                    flexShrink: 0
                  }}>
                    <input
                      type="checkbox"
                      checked={standardMode}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        setStandardMode(newValue);
                        if (newValue) {
                          setFastMode(false);
                          setCarefulMode(false);
                        }
                      }}
                      style={{
                        opacity: 0,
                        width: 0,
                        height: 0
                      }}
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: standardMode ? '#3B82F6' : '#D1D5DB',
                      borderRadius: '20px',
                      transition: '0.3s',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px'
                    }}>
                      <span style={{
                        content: '""',
                        position: 'absolute',
                        height: '16px',
                        width: '16px',
                        left: standardMode ? '22px' : '2px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '50%',
                        transition: '0.3s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </span>
                  </label>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: standardMode ? '#3B82F6' : '#1F2937'
                      }}>
                        Standard Mode
                      </span>
                      <div 
                        style={{
                          position: 'relative',
                          display: 'inline-block',
                          cursor: 'help'
                        }}
                        onMouseEnter={() => setShowStandardTooltip(true)}
                        onMouseLeave={() => setShowStandardTooltip(false)}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: '#6B7280' }}>
                          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                          <text x="8" y="11" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="bold">?</text>
                        </svg>
                        {showStandardTooltip && (
                          <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginBottom: '8px',
                            padding: '8px 12px',
                            background: '#1F2937',
                            color: '#FFFFFF',
                            borderRadius: '6px',
                            fontSize: '12px',
                            zIndex: 1000,
                            width: '200px',
                            whiteSpace: 'normal',
                            textAlign: 'left',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }}>
                            <strong>Standard Mode (70% probability)</strong><br/>
                            Balanced approach with moderate confidence. Recommended for most tests.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Careful Mode */}
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0',
                padding: '12px',
                background: carefulMode ? '#E0F2FE' : '#FFFFFF',
                border: carefulMode ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                borderRadius: '8px',
                transition: 'all 0.2s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <label style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: '40px',
                    height: '20px',
                    flexShrink: 0
                  }}>
                    <input
                      type="checkbox"
                      checked={carefulMode}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        setCarefulMode(newValue);
                        if (newValue) {
                          setFastMode(false);
                          setStandardMode(false);
                        }
                      }}
                      style={{
                        opacity: 0,
                        width: 0,
                        height: 0
                      }}
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: carefulMode ? '#3B82F6' : '#D1D5DB',
                      borderRadius: '20px',
                      transition: '0.3s',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px'
                    }}>
                      <span style={{
                        content: '""',
                        position: 'absolute',
                        height: '16px',
                        width: '16px',
                        left: carefulMode ? '22px' : '2px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '50%',
                        transition: '0.3s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </span>
                  </label>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: carefulMode ? '#3B82F6' : '#1F2937'
                      }}>
                        Careful Mode
                      </span>
                      <div 
                        style={{
                          position: 'relative',
                          display: 'inline-block',
                          cursor: 'help'
                        }}
                        onMouseEnter={() => setShowCarefulTooltip(true)}
                        onMouseLeave={() => setShowCarefulTooltip(false)}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: '#6B7280' }}>
                          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                          <text x="8" y="11" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="bold">?</text>
                        </svg>
                        {showCarefulTooltip && (
                          <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginBottom: '8px',
                            padding: '8px 12px',
                            background: '#1F2937',
                            color: '#FFFFFF',
                            borderRadius: '6px',
                            fontSize: '12px',
                            zIndex: 1000,
                            width: '200px',
                            whiteSpace: 'normal',
                            textAlign: 'left',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }}>
                            <strong>Careful Mode (95% probability)</strong><br/>
                            High statistical significance. Best for critical decisions requiring maximum confidence.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Manual Mode Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: manualMode ? '16px' : '0',
            paddingBottom: manualMode ? '16px' : '0',
            borderBottom: manualMode ? '1px solid #E5E7EB' : 'none'
          }}>
            <div>
              <label style={{
                fontSize: '16px',
                fontWeight: '600',
                color: manualMode ? '#3B82F6' : '#1F2937',
                marginBottom: '4px',
                display: 'block',
                transition: 'color 0.2s ease'
              }}>
                Manual Mode
              </label>
              <p style={{
                fontSize: '12px',
                color: '#6B7280',
                margin: 0
              }}>
                Set end conditions manually
              </p>
            </div>
            <label style={{
              position: 'relative',
              display: 'inline-block',
              width: '48px',
              height: '24px'
            }}>
              <input
                type="checkbox"
                checked={manualMode}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setManualMode(newValue);
                  // If manual mode is turned on, autopilot must be off
                  if (newValue) {
                    setAutopilotOn(false);
                    // Reset mode selections when switching to manual
                    setFastMode(false);
                    setStandardMode(false);
                    setCarefulMode(false);
                  } else {
                    // If manual mode is turned off, autopilot must be on (mutually exclusive)
                    setAutopilotOn(true);
                  }
                }}
                style={{
                  opacity: 0,
                  width: 0,
                  height: 0
                }}
              />
              <span style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: manualMode ? '#3B82F6' : '#D1D5DB',
                borderRadius: '24px',
                transition: '0.3s',
                display: 'flex',
                alignItems: 'center',
                padding: '2px'
              }}>
                <span style={{
                  content: '""',
                  position: 'absolute',
                  height: '20px',
                  width: '20px',
                  left: manualMode ? '26px' : '2px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '50%',
                  transition: '0.3s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </span>
            </label>
          </div>

          {/* Manual Mode Explanation */}
          {manualMode && (
            <div style={{
              marginTop: '12px',
              marginBottom: '16px',
              padding: '12px',
              background: '#F0F9FF',
              border: '1px solid #3B82F6',
              borderRadius: '6px'
            }}>
              <p style={{
                fontSize: '13px',
                color: '#1F2937',
                margin: 0,
                lineHeight: '1.5'
              }}>
                <strong>Note:</strong> In manual mode, the primary measure we're targeting is <strong>add-to-cart</strong>, given that we're using widgets to optimize conversion.
              </p>
            </div>
          )}
        </div>

        {/* End Test Section - Only shown when Manual Mode is ON */}
        {manualMode && (
          <div style={{ 
            marginLeft: '24px',
            marginTop: '16px',
            paddingLeft: '24px',
            borderLeft: '3px solid #3B82F6',
            background: '#F0F9FF',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '0'
          }}>
            {/* End Date Input */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #3B82F6',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#3B82F6',
                marginBottom: '8px'
              }}>
                End Date
              </label>
              <input
                type="datetime-local"
                value={endOnDate}
                min={(() => {
                  const minDate = new Date();
                  minDate.setDate(minDate.getDate() + 7); // Minimum 1 week from today
                  return minDate.toISOString().slice(0, 16);
                })()}
                onChange={(e) => {
                  const selectedDate = new Date(e.target.value);
                  const minDate = new Date();
                  minDate.setDate(minDate.getDate() + 7);
                  
                  if (selectedDate < minDate) {
                    setWizardLaunchError('End date must be at least 1 week from today');
                  } else {
                    setWizardLaunchError(null);
                    setEndOnDate(e.target.value);
                  }
                }}
                style={{
                  width: '100%',
                  maxWidth: '300px',
                  padding: '8px 12px',
                  border: '1px solid #3B82F6',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#1F2937',
                  outline: 'none',
                  background: '#F9FAFB'
                }}
              />
              <p style={{
                fontSize: '12px',
                color: '#6B7280',
                margin: '8px 0 0 0'
              }}>
                Test will end on this date. Minimum duration is 1 week from today.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Validation Notices */}
      {wizardLaunchError && (
        <div style={{
          background: '#FEE2E2',
          border: '1px solid #EF4444',
          color: '#B91C1C',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px'
        }}>
          {wizardLaunchError}
        </div>
      )}

      {wizardLaunchSuccess && (
        <div style={{
          background: '#ECFDF5',
          border: '1px solid #10B981',
          color: '#065F46',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px'
        }}>
          {wizardLaunchSuccess}
        </div>
      )}

      {/* Launch Test Button - Bottom Right */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '32px'
      }}>
        <button
          onClick={handleLaunchTest}
          disabled={isLaunchingTest || !canLaunchTest}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 28px',
            background: (isLaunchingTest || !canLaunchTest) ? '#D1D5DB' : '#10B981',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: (isLaunchingTest || !canLaunchTest) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: (isLaunchingTest || !canLaunchTest) ? 0.6 : 1,
            boxShadow: (isLaunchingTest || !canLaunchTest) ? 'none' : '0 2px 4px rgba(16, 185, 129, 0.3)'
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.background = '#059669';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.background = '#10B981';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
          </svg>
          {isLaunchingTest ? 'Launching Test...' : 'Launch Test'}
        </button>
      </div>
    </div>
  );
}

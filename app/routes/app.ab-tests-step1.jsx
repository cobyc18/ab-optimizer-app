import React, { useEffect } from 'react';

export default function Step1({
  products,
  selectedProduct,
  productSearchQuery,
  setProductSearchQuery,
  currentProductPage,
  setCurrentProductPage,
  handleProductSelection,
  createVariantTemplate,
  setCurrentStep,
  isVariantRequestInFlight,
  isCheckingProductInTest,
  setIsCheckingProductInTest,
  productInTestError,
  setProductInTestError
}) {
  const filteredProducts = products.filter(product => 
    product.title.toLowerCase().includes(productSearchQuery.toLowerCase())
  );
  const productsPerPage = 12; // 3 rows × 4 columns
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const startIndex = (currentProductPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const currentPageProducts = filteredProducts.slice(startIndex, endIndex);
  
  // Reset to page 1 if current page is out of bounds
  useEffect(() => {
    if (currentProductPage > totalPages && totalPages > 0) {
      setCurrentProductPage(1);
    }
  }, [currentProductPage, totalPages, setCurrentProductPage]);

  return (
    <div style={{
      animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      transform: 'translateX(0)',
      opacity: 1
    }}>
      <h3 style={{
        fontSize: '24px',
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: '8px'
      }}>
        Select a product to test
      </h3>
      <p style={{
        fontSize: '14px',
        color: '#6B7280',
        marginBottom: '24px'
      }}>
        Choose a high-traffic product page from your store.
      </p>

      {/* Search Bar */}
      <div style={{
        position: 'relative',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'flex-start'
      }}>
        <div style={{
          position: 'relative',
          width: '400px',
          maxWidth: '100%'
        }}>
          <div style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            zIndex: 1
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <input
            type="text"
            value={productSearchQuery}
            onChange={(e) => {
              setProductSearchQuery(e.target.value);
              setCurrentProductPage(1); // Reset to page 1 when searching
            }}
            placeholder="Search products..."
            style={{
              width: '100%',
              padding: '12px 16px 12px 48px',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              fontSize: '14px',
              background: '#FFFFFF',
              outline: 'none',
              transition: 'border-color 0.2s ease',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3B82F6';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#E5E7EB';
            }}
          />
        </div>
      </div>

      {/* Filtered Products Grid */}
      <>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {currentPageProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => {
                handleProductSelection(product);
              }}
              style={{
                background: '#FFFFFF',
                border: selectedProduct?.id === product.id ? '3px solid #0038ff' : '1px solid #E5E7EB',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative', // For absolute positioning of checkmark
                boxShadow: selectedProduct?.id === product.id ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                transform: selectedProduct?.id === product.id ? 'scale(1.02)' : 'scale(1)'
              }}
              onMouseEnter={(e) => {
                if (selectedProduct?.id !== product.id) {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedProduct?.id !== product.id) {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              {/* Checkmark icon - top right (same as conversion play cards) */}
              {selectedProduct?.id === product.id && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
                }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M13.3333 4L6 11.3333L2.66667 8"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
              {/* Product Image */}
              <div style={{
                width: '100%',
                aspectRatio: '1',
                background: '#F3F4F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative'
              }}>
                {product.featuredImage ? (
                  <img
                    src={product.featuredImage.url}
                    alt={product.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: '#E5E7EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9CA3AF',
                    fontSize: '14px'
                  }}>
                    No Image
                  </div>
                )}
              </div>
              
              {/* Product Title */}
              <div style={{
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <h4 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1F2937',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: '1.4'
                }}>
                  {product.title}
                </h4>
              </div>
            </div>
          ))}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            marginBottom: '32px'
          }}>
            {/* Left Arrow */}
            <button
              onClick={() => {
                if (currentProductPage > 1) {
                  setCurrentProductPage(currentProductPage - 1);
                }
              }}
              disabled={currentProductPage === 1}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                background: currentProductPage === 1 ? '#F3F4F6' : '#FFFFFF',
                cursor: currentProductPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentProductPage === 1 ? 0.5 : 1,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (currentProductPage > 1) {
                  e.currentTarget.style.borderColor = '#3B82F6';
                  e.currentTarget.style.background = '#F0F9FF';
                }
              }}
              onMouseLeave={(e) => {
                if (currentProductPage > 1) {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.background = '#FFFFFF';
                }
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={currentProductPage === 1 ? '#9CA3AF' : '#374151'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            
            {/* Page Number */}
            <span style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1F2937',
              minWidth: '40px',
              textAlign: 'center'
            }}>
              {currentProductPage}
            </span>
            
            {/* Right Arrow */}
            <button
              onClick={() => {
                if (currentProductPage < totalPages) {
                  setCurrentProductPage(currentProductPage + 1);
                }
              }}
              disabled={currentProductPage === totalPages}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                background: currentProductPage === totalPages ? '#F3F4F6' : '#FFFFFF',
                cursor: currentProductPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentProductPage === totalPages ? 0.5 : 1,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (currentProductPage < totalPages) {
                  e.currentTarget.style.borderColor = '#3B82F6';
                  e.currentTarget.style.background = '#F0F9FF';
                }
              }}
              onMouseLeave={(e) => {
                if (currentProductPage < totalPages) {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.background = '#FFFFFF';
                }
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={currentProductPage === totalPages ? '#9CA3AF' : '#374151'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
        )}
      </>

      {/* Product In Test Error Message */}
      {productInTestError && (
        <div style={{
          marginTop: '24px',
          padding: '12px 16px',
          background: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: '8px',
          color: '#991B1B',
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          {productInTestError}
        </div>
      )}

      {/* Next Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '24px',
        paddingRight: '10px'
      }}>
        <button
          onClick={async () => {
            if (selectedProduct) {
              // First, check if product is already in a running test
              setIsCheckingProductInTest(true);
              setProductInTestError(null);
              
              try {
                const checkResponse = await fetch('/api/check-product-in-test', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    productId: selectedProduct.id
                  })
                });
                
                if (!checkResponse.ok) {
                  console.error('❌ Check product API returned error:', checkResponse.status, checkResponse.statusText);
                  // On API errors, show warning but allow continuation (fail open)
                  setProductInTestError(
                    'Unable to verify if this product is available. Please try again or contact support if this persists.'
                  );
                  setIsCheckingProductInTest(false);
                  // Don't return - allow continuation on errors
                } else {
                  const checkResult = await checkResponse.json();
                  
                  if (checkResult.inUse) {
                    // Product is in use - BLOCK progression
                    setProductInTestError(
                      `This product is already being used in a running A/B test: "${checkResult.testName}". Please select a different product.`
                    );
                    setIsCheckingProductInTest(false);
                    return; // Block here
                  }
                  
                  // Product is available - clear any previous errors and continue
                  setProductInTestError(null);
                  setIsCheckingProductInTest(false);
                }
              } catch (checkError) {
                console.error('❌ Error checking if product is in test:', checkError);
                // Network errors - show warning but allow continuation (fail open)
                setProductInTestError(
                  'Unable to verify if this product is available. Please check your connection and try again.'
                );
                setIsCheckingProductInTest(false);
                // Don't return - allow continuation on network errors
              }
              
              // Trigger template duplication when moving to step 2
              const result = await createVariantTemplate();
              if (result?.success) {
                setCurrentStep(2);
              } else {
                if (result?.error && result.error !== 'request_in_flight') {
                  const errorCopy = typeof result.error === 'string' ? result.error : '';
                  const friendlyErrorMap = {
                    no_product_selected: 'Please select a product before continuing.',
                    request_in_flight: 'We are still working on the previous request.',
                    variant_template_creation_failed: 'Shopify did not allow us to duplicate the template. Please try again in a few seconds.',
                    no_product_selected_for_variant_template: 'Please select a product before continuing.'
                  };
                  const friendlyMessage = friendlyErrorMap[errorCopy] || errorCopy || 'Please try again in a few seconds.';
                  alert(`We couldn't duplicate the template yet. ${friendlyMessage}`);
                }
              }
            }
          }}
          disabled={!selectedProduct || isVariantRequestInFlight || isCheckingProductInTest}
          style={{
            padding: '12px 32px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#FFFFFF',
            background: (!selectedProduct || isVariantRequestInFlight || isCheckingProductInTest) 
              ? '#D1D5DB' 
              : '#3B82F6',
            border: 'none',
            borderRadius: '8px',
            cursor: (!selectedProduct || isVariantRequestInFlight || isCheckingProductInTest) 
              ? 'not-allowed' 
              : 'pointer',
            transition: 'all 0.2s ease',
            opacity: (!selectedProduct || isVariantRequestInFlight || isCheckingProductInTest) 
              ? 0.6 
              : 1
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.background = '#2563EB';
            }
          }}
          onMouseLeave={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.background = '#3B82F6';
            }
          }}
        >
          {isCheckingProductInTest 
            ? 'Checking...' 
            : isVariantRequestInFlight 
              ? 'Duplicating Template...' 
              : 'Next'}
        </button>
      </div>
    </div>
  );
}

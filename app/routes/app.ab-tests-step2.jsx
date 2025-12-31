import React, { useState, useEffect } from 'react';
import { figmaColors } from "./app.ab-tests.shared.jsx";
import freeShippingBadgeImage from "../assets/free-shipping-badge.png";
import moneyBackGuaranteeImage from "../assets/money-back-guarantee.png";
import addToCartImage from "../assets/add-to-cart.png";

export default function Step2({
  wizardVariantName,
  selectedIdea,
  canOpenThemeEditor,
  isVariantRequestInFlight,
  isVariantTemplateReady,
  openVariantInThemeEditor,
  checkIfBlockSaved,
  isCheckingBlockSaved,
  isBlockSaved,
  setCurrentStep
}) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success'); // 'success' or 'error'
  const [hasOpenedThemeEditor, setHasOpenedThemeEditor] = useState(false);

  // Show toast when isBlockSaved changes
  useEffect(() => {
    if (isBlockSaved) {
      setToastMessage('Widget Verified!');
      setToastType('success');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    }
  }, [isBlockSaved]);

  const handleOpenThemeEditor = () => {
    openVariantInThemeEditor();
    // Delay unfading step 2 by 2 seconds to give time for theme editor to open
    setTimeout(() => {
      setHasOpenedThemeEditor(true);
    }, 2000);
  };

  const handleVerifyClick = async () => {
    const wasSaved = await checkIfBlockSaved();
    if (wasSaved === false) {
      setToastMessage('Widget not detected. Please ensure you clicked save in the theme editor');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
      // Reset to step 1 - fade step 2, unfade step 1
      setHasOpenedThemeEditor(false);
    }
  };

  return (
    <div style={{
      animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      transform: 'translateX(0)',
      opacity: 1,
      display: 'flex',
      gap: '40px',
      alignItems: 'flex-start'
    }}>
      {/* Left side - Steps */}
      <div style={{ flex: 1, maxWidth: '600px' }}>
        <h2 style={{
          fontSize: '32px',
          fontWeight: '700',
          color: '#1F2937',
          marginBottom: '12px'
        }}>
          Let's activate the '{selectedIdea?.utility || 'widget'}' idea
        </h2>
        <p style={{
          fontSize: '16px',
          color: '#6B7280',
          marginBottom: '40px'
        }}>
          TryLab has already inserted your widget into your product template <strong>{wizardVariantName ? `product.${wizardVariantName}` : 'product'}</strong>. Just click Save in Shopify.
        </p>

      {/* Step 1: Save in Theme Editor (Faded when step 2 or step 3 is active) */}
      <div style={{
        marginBottom: '24px'
      }}>
        <div style={{
          background: (!hasOpenedThemeEditor && !isBlockSaved) ? '#D8D8D8' : '#F3F4F6',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '10px',
          width: '100%',
          minHeight: '140px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          opacity: (!hasOpenedThemeEditor && !isBlockSaved) ? 1 : 0.6
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: (!hasOpenedThemeEditor && !isBlockSaved) ? '#1F2937' : '#9CA3AF',
            margin: 0
          }}>
            Save in Theme Editor:
          </h3>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '8px'
          }}>
            <p style={{
              fontSize: '14px',
              color: (!hasOpenedThemeEditor && !isBlockSaved) ? '#374151' : '#9CA3AF',
              margin: 0,
              lineHeight: '1.6'
            }}>
              <strong>1.</strong> Click the button below to open your theme.
            </p>
            <p style={{
              fontSize: '14px',
              color: (!hasOpenedThemeEditor && !isBlockSaved) ? '#374151' : '#9CA3AF',
              margin: 0,
              lineHeight: '1.6'
            }}>
              <strong>2.</strong> A Trylab widget block will appear. Click "Save" in top right.
            </p>
            <p style={{
              fontSize: '14px',
              color: (!hasOpenedThemeEditor && !isBlockSaved) ? '#374151' : '#9CA3AF',
              margin: 0,
              lineHeight: '1.6'
            }}>
              <strong>3.</strong> Come back here to customize the look.
            </p>
          </div>
          <button
            onClick={handleOpenThemeEditor}
            disabled={!canOpenThemeEditor || hasOpenedThemeEditor || isBlockSaved}
            style={{
              padding: '12px 24px',
              background: (!canOpenThemeEditor || hasOpenedThemeEditor || isBlockSaved) ? '#9CA3AF' : '#3B82F6',
              color: '#FFFFFF',
              borderRadius: '8px',
              border: 'none',
              cursor: (!canOpenThemeEditor || hasOpenedThemeEditor || isBlockSaved) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: 'fit-content',
              alignSelf: 'flex-start'
            }}
          >
            {isVariantRequestInFlight && !isVariantTemplateReady ? 'Preparing Theme Editor…' : 'Open Theme Editor'}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 8H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Step 2: Verify Activation (Faded initially, becomes active when step 1 button is clicked, fades when step 3 is active) */}
      <div style={{
        marginBottom: showToast ? '80px' : '24px'
      }}>
        <div style={{
          background: (hasOpenedThemeEditor && !isBlockSaved) ? '#D8D8D8' : '#F3F4F6',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '10px',
          width: '100%',
          minHeight: '140px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          opacity: (hasOpenedThemeEditor && !isBlockSaved) ? 1 : 0.6
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: (hasOpenedThemeEditor && !isBlockSaved) ? '#1F2937' : '#9CA3AF',
            margin: 0
          }}>
            Verify Activation:
          </h3>
          <p style={{
            fontSize: '14px',
            color: (hasOpenedThemeEditor && !isBlockSaved) ? '#374151' : '#9CA3AF',
            margin: 0,
            lineHeight: '1.6'
          }}>
            Once saved, click confirm to let us verify the setup was completed correctly.
          </p>
          <button
            onClick={handleVerifyClick}
            disabled={isCheckingBlockSaved || !hasOpenedThemeEditor || isBlockSaved}
            style={{
              padding: '12px 24px',
              background: (isCheckingBlockSaved || !hasOpenedThemeEditor || isBlockSaved) ? '#9CA3AF' : '#3B82F6',
              color: '#FFFFFF',
              borderRadius: '8px',
              border: 'none',
              cursor: (isCheckingBlockSaved || !hasOpenedThemeEditor || isBlockSaved) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: 'fit-content',
              alignSelf: 'flex-start'
            }}
          >
            {isCheckingBlockSaved ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #FFFFFF',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                Checking...
              </>
            ) : (
              'Click after saving in Shopify.'
            )}
          </button>
          
          {/* Toast Notification - Below verify button */}
          {showToast && (
            <div style={{
              marginTop: '12px',
              animation: 'slideInFromRight 0.3s ease-out'
            }}>
              <div style={{
                background: toastType === 'success' ? '#1F2937' : '#7F1D1D',
                border: '1px solid #374151',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                minWidth: '300px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
              }}>
                {/* Icon */}
                {toastType === 'success' ? (
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#10B981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.6667 3.5L5.25 9.91667L2.33334 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                ) : (
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#EF4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 3.5V7M7 10.5H7.00583M13.4167 7C13.4167 10.4058 10.6558 13.1667 7.25 13.1667C3.84417 13.1667 1.08334 10.4058 1.08334 7C1.08334 3.59417 3.84417 0.833336 7.25 0.833336C10.6558 0.833336 13.4167 3.59417 13.4167 7Z" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                )}
                {/* Message */}
                <p style={{
                  fontSize: '14px',
                  color: '#FFFFFF',
                  margin: 0,
                  fontWeight: '500',
                  flex: 1
                }}>
                  {toastMessage}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 3: Widget Successfully Activated (Only appears when verification succeeds) */}
      {isBlockSaved && (
        <div style={{
          marginBottom: '32px'
        }}>
          <div style={{
            background: '#D8D8D8',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            padding: '10px',
            width: '100%',
            minHeight: '140px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            opacity: 1
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1F2937',
              margin: 0
            }}>
              Widget successfully activated!
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#374151',
              margin: 0,
              lineHeight: '1.6'
            }}>
              Next, let's customize how it looks.
            </p>
          </div>
        </div>
      )}

      {/* Next button - only enabled when saved */}
      {isBlockSaved && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: '24px'
        }}>
          <button
            onClick={() => setCurrentStep(3)}
            style={{
              padding: '12px 32px',
              background: '#3B82F6',
              color: '#FFFFFF',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600'
            }}
          >
            Next
          </button>
        </div>
      )}
      </div>

      {/* Right side - Video Placeholder */}
      <div style={{
        flex: 1,
        maxWidth: '450px',
        position: 'sticky',
        top: '132px'
      }}>
        <div style={{
          backgroundColor: '#D8D8D8',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '40px',
          margin: '0',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          width: '100%'
        }}>
          {/* Video Placeholder Icon */}
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: '#9CA3AF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px'
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 5V19L19 12L8 5Z" fill="#FFFFFF"/>
            </svg>
          </div>
          <p style={{
            fontSize: '16px',
            color: '#6B7280',
            margin: 0,
            fontWeight: '500'
          }}>
            Video placeholder
          </p>
        </div>
      </div>
    </div>
  );
}

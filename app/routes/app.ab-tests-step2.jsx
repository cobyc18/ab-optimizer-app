import React from 'react';
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

      {/* Step 1: Save in Theme Editor (Active) */}
      <div style={{
        marginBottom: '24px'
      }}>
        <div style={{
          background: '#D8D8D8',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          minHeight: '140px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#1F2937',
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
              color: '#374151',
              margin: 0,
              lineHeight: '1.6'
            }}>
              <strong>1.</strong> Click the button below to open your theme.
            </p>
            <p style={{
              fontSize: '14px',
              color: '#374151',
              margin: 0,
              lineHeight: '1.6'
            }}>
              <strong>2.</strong> A Trylab widget block will appear. Click "Save" in top right.
            </p>
            <p style={{
              fontSize: '14px',
              color: '#374151',
              margin: 0,
              lineHeight: '1.6'
            }}>
              <strong>3.</strong> Come back here to customize the look.
            </p>
          </div>
          <button
            onClick={openVariantInThemeEditor}
            disabled={!canOpenThemeEditor}
            style={{
              padding: '12px 24px',
              background: canOpenThemeEditor ? '#3B82F6' : '#9CA3AF',
              color: '#FFFFFF',
              borderRadius: '8px',
              border: 'none',
              cursor: canOpenThemeEditor ? 'pointer' : 'not-allowed',
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

      {/* Step 2: Return here (Inactive/Faded) */}
      <div style={{
        marginBottom: '32px'
      }}>
        <div style={{
          background: '#F3F4F6',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          minHeight: '140px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          opacity: 0.6
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#9CA3AF',
            margin: 0
          }}>
            Return here:
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#9CA3AF',
            margin: 0,
            lineHeight: '1.6'
          }}>
            We'll verify your installation automatically.
          </p>
        </div>
      </div>

      {/* I've saved in Shopify button */}
      <div style={{
        marginBottom: '40px'
      }}>
        <button
          onClick={async () => {
            const wasSaved = await checkIfBlockSaved();
            if (wasSaved === false) {
              alert('Widget not found. Please make sure you clicked the Save button in the Shopify theme editor and try again.');
            }
          }}
          disabled={isCheckingBlockSaved}
          style={{
            padding: '12px 32px',
            background: isCheckingBlockSaved ? '#9CA3AF' : '#3B82F6',
            color: '#FFFFFF',
            borderRadius: '8px',
            border: 'none',
            cursor: isCheckingBlockSaved ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
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
            <>
              I've saved in Shopify
            </>
          )}
        </button>
        {isBlockSaved && (
          <p style={{
            fontSize: '14px',
            color: '#3B82F6',
            margin: '12px 0 0 0',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ color: '#3B82F6' }}>✅</span> Installation verified! You can proceed to the next step.
          </p>
        )}
      </div>

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

      {/* Right side - Conversion Play Display */}
      {selectedIdea && (
        <div style={{
          flex: 1,
          maxWidth: '450px',
          position: 'sticky',
          top: '20px'
        }}>
          <div style={{
            backgroundColor: figmaColors.gray,
            border: `1px solid ${figmaColors.primaryBlue}`,
            borderRadius: '24px',
            padding: '40px',
            margin: '0',
            boxSizing: 'border-box',
            overflow: 'visible',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            alignItems: 'center',
            minHeight: '650px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '50px', alignItems: 'center', width: '100%', boxSizing: 'border-box', position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                {/* Widget Preview - Image Section */}
                <div style={{ 
                  width: '350px', 
                  height: '280px', 
                  borderRadius: '10px', 
                  overflow: 'hidden',
                  boxSizing: 'border-box'
                }}>
                  {selectedIdea.utility === 'Free Shipping Badge' ? (
                    <img 
                      src={freeShippingBadgeImage} 
                      alt="Free Shipping Badge"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block'
                      }}
                    />
                  ) : selectedIdea.utility === 'How Many in Cart' ? (
                    <img 
                      src={addToCartImage} 
                      alt="How Many in Cart"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block'
                      }}
                    />
                  ) : selectedIdea.utility === 'Returns Guarantee Badge' ? (
                    <img 
                      src={moneyBackGuaranteeImage} 
                      alt="Returns Guarantee Badge"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block'
                      }}
                    />
                  ) : null}
                </div>

                {/* Title and Description Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                  {/* Title */}
                  <p style={{
                    fontFamily: 'Geist, sans-serif',
                    fontWeight: 600,
                    fontSize: '20px',
                    color: figmaColors.darkGray,
                    margin: 0,
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    width: '100%',
                    boxSizing: 'border-box',
                    textAlign: 'center'
                  }}>
                    {selectedIdea.utility}
                  </p>
                  
                  {/* Tags */}
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    {(Array.isArray(selectedIdea.style) ? selectedIdea.style : [selectedIdea.style]).map((tag, tagIndex) => (
                      <div
                        key={tagIndex}
                        style={{
                          background: '#FFFFFF',
                          color: '#1E40AF',
                          padding: '8px 16px',
                          borderRadius: '16px',
                          fontSize: '14px',
                          fontWeight: '500',
                          width: 'fit-content',
                          border: '1px solid #E5E7EB',
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word',
                          maxWidth: '100%',
                          boxSizing: 'border-box'
                        }}
                      >
                        {tag}
                      </div>
                    ))}
                  </div>
                  
                  {/* Description */}
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px',
                    color: figmaColors.darkGray,
                    margin: 0,
                    lineHeight: '20px',
                    width: '100%',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    boxSizing: 'border-box',
                    textAlign: 'center'
                  }}>
                    {selectedIdea.rationale}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

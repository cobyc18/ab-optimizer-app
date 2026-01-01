import React, { useState, useEffect, useRef } from 'react';

export default function Step4({
  selectedIdea,
  wizardSelectedProductSnapshot,
  selectedProduct,
  wizardTestName,
  setWizardTestName,
  isEditingTestName,
  setIsEditingTestName,
  testHypothesis,
  setTestHypothesis,
  isEditingHypothesis,
  setIsEditingHypothesis,
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
  const confettiContainerRef = useRef(null);

  // Set standardMode to true by default when autopilot is on
  useEffect(() => {
    if (autopilotOn && !fastMode && !standardMode && !carefulMode) {
      setStandardMode(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autopilotOn]);

  // Auto-hide success message after 2 seconds
  useEffect(() => {
    if (wizardLaunchSuccess) {
      const timer = setTimeout(() => {
        setWizardLaunchSuccess(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [wizardLaunchSuccess]);

  // Confetti animation function - more prominent
  const createConfetti = () => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
    const confettiCount = 200; // Increased from 100
    const container = confettiContainerRef.current;
    if (!container) return;

    // Clear any existing confetti
    container.innerHTML = '';

    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = Math.random() * 12 + 6; // Increased size
      const startX = Math.random() * window.innerWidth;
      const startY = -20;
      const endY = window.innerHeight + 20;
      const rotation = Math.random() * 720; // More rotation
      const duration = Math.random() * 3 + 3; // Longer duration
      const horizontalDrift = (Math.random() - 0.5) * 200; // Add horizontal movement

      confetti.style.position = 'fixed';
      confetti.style.left = `${startX}px`;
      confetti.style.top = `${startY}px`;
      confetti.style.width = `${size}px`;
      confetti.style.height = `${size}px`;
      confetti.style.backgroundColor = color;
      confetti.style.borderRadius = '50%';
      confetti.style.pointerEvents = 'none';
      confetti.style.zIndex = '10000';
      confetti.style.opacity = '1';
      confetti.style.boxShadow = `0 0 ${size}px ${color}`; // Add glow effect

      container.appendChild(confetti);

      // Animate with horizontal drift
      confetti.animate([
        { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${horizontalDrift}px, ${endY}px) rotate(${rotation}deg)`, opacity: 0 }
      ], {
        duration: duration * 1000,
        easing: 'cubic-bezier(0.5, 0, 0.5, 1)'
      }).onfinish = () => confetti.remove();
    }

    // Clear confetti after animation
    setTimeout(() => {
      container.innerHTML = '';
    }, 8000); // Increased timeout
  };

  const handleLaunchWithConfetti = () => {
    createConfetti();
    handleLaunchTest();
  };
  return (
    <div style={{
      animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      transform: 'translateX(0)',
      opacity: 1,
      background: '#D8D8D8',
      minHeight: '100vh',
      padding: '40px'
    }}>
      {/* Confetti Container */}
      <div ref={confettiContainerRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10000 }} />

      {/* Main Dark Grey Container - No white container inside */}
      <div style={{
        background: '#D8D8D8',
        borderRadius: '12px',
        border: '1px solid #C0C0C0',
        padding: '40px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* 1. Test Name */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          padding: '20px 24px',
          marginBottom: '24px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            fontSize: '22px',
            fontWeight: '700',
            color: '#1F2937',
            marginBottom: '12px'
          }}>
            Test Name
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
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
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #3B82F6',
                  borderRadius: '4px',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#1F2937',
                  outline: 'none'
                }}
              />
            ) : (
              <>
                <p
                  onClick={() => setIsEditingTestName(true)}
                  style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#1F2937',
                    margin: 0,
                    cursor: 'text',
                    flex: 1
                  }}
                >
                  {wizardTestName || (selectedIdea && (wizardSelectedProductSnapshot || selectedProduct) 
                    ? `${selectedIdea.utility || 'Widget'} on ${wizardSelectedProductSnapshot?.title || selectedProduct?.title || 'Product'}`
                    : 'Test Name')}
                </p>
                <svg
                  onClick={() => setIsEditingTestName(true)}
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#6B7280"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ cursor: 'pointer' }}
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </>
            )}
          </div>
        </div>

        {/* 2. Hypothesis - Non-editable, bold, title font */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          padding: '20px 24px',
          marginBottom: '24px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            fontSize: '22px',
            fontWeight: '700',
            color: '#1F2937',
            marginBottom: '12px'
          }}>
            Hypothesis
          </div>
          <p style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#1F2937',
            margin: 0,
            lineHeight: '1.6'
          }}>
            {testHypothesis || `Adding a ${selectedIdea?.utility || 'widget'} near the price will increase Add to Cart actions.`}
          </p>
        </div>

        {/* 3. Variants */}
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {/* A - Control */}
          <div style={{
            flex: 1,
            background: '#FFFFFF',
            border: '2px solid #E5E7EB',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#374151',
                background: '#E5E7EB',
                borderRadius: '4px',
                padding: '4px 10px'
              }}>A</span>
              <span style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#374151'
              }}>Control</span>
            </div>
            <p style={{
              fontSize: '14px',
              color: '#6B7280',
              margin: 0
            }}>
              {wizardSelectedProductSnapshot?.title || selectedProduct?.title || 'Original Product'}
            </p>
          </div>

          {/* B - Variant */}
          <div style={{
            flex: 1,
            background: '#FFFFFF',
            border: '2px solid #3B82F6',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#FFFFFF',
                background: '#3B82F6',
                borderRadius: '4px',
                padding: '4px 10px'
              }}>B</span>
              <span style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#3B82F6'
              }}>Variant</span>
            </div>
            <p style={{
              fontSize: '14px',
              color: '#1E40AF',
              margin: 0
            }}>
              The original product with added {selectedIdea?.utility || 'widget'}.
            </p>
          </div>
        </div>

        {/* 4. Traffic Split */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          padding: '20px 24px',
          marginBottom: '24px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <span style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1F2937'
            }}>
              {trafficSplitA} / {trafficSplitB}
            </span>
          </div>
          <p style={{
            fontSize: '16px',
            color: '#6B7280',
            margin: 0
          }}>
            TryLab recommends a balanced split.
          </p>
        </div>

        {/* 5. Goal Metric */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          padding: '20px 24px',
          marginBottom: '24px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <span style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1F2937'
            }}>
              Add to Cart
            </span>
          </div>
          <p style={{
            fontSize: '16px',
            color: '#6B7280',
            margin: 0
          }}>
            Best for PDP changes.
          </p>
        </div>

        {/* 6. Autopilot Mode */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          padding: '20px 24px',
          marginBottom: '24px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '8px',
              display: 'block'
            }}>
              Autopilot Mode
            </label>
            <p style={{
              fontSize: '16px',
              color: '#6B7280',
              margin: '0 0 12px 0'
            }}>
              Most stores see clear results in ~2 weeks
            </p>
          </div>

          {/* Mode Selection - All three modes shown */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
              
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
          </div>

        {/* 7. Manual Mode - Bigger text with toggle */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          padding: '20px 24px',
          marginBottom: '24px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: manualMode ? '16px' : '0'
          }}>
            <label style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1F2937',
              display: 'block'
            }}>
              Manual Mode
            </label>
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
                  if (newValue) {
                    setAutopilotOn(false);
                    setFastMode(false);
                    setStandardMode(false);
                    setCarefulMode(false);
                  } else {
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

          {/* Manual Mode Collapsible Content */}
          {manualMode && (
            <div style={{
              marginTop: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {/* Traffic Split - Separate white container */}
              <div style={{
                background: '#F9FAFB',
                borderRadius: '8px',
                padding: '20px',
                border: '1px solid #E5E7EB'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#374151',
                  marginBottom: '16px'
                }}>
                  Traffic Split
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    minWidth: '80px',
                    textAlign: 'left'
                  }}>
                    <span style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      Control
                    </span>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#1F2937',
                      marginTop: '4px'
                    }}>
                      {trafficSplitA}%
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={trafficSplitA}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setTrafficSplitA(val);
                      setTrafficSplitB(100 - val);
                    }}
                    style={{
                      flex: 1,
                      height: '8px',
                      background: '#e5e7eb',
                      borderRadius: '4px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  />
                  <div style={{
                    minWidth: '80px',
                    textAlign: 'right'
                  }}>
                    <span style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      Variant
                    </span>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#1F2937',
                      marginTop: '4px'
                    }}>
                      {trafficSplitB}%
                    </div>
                  </div>
                </div>
              </div>

              {/* End Conditions - Separate white container */}
              <div style={{
                background: '#F9FAFB',
                borderRadius: '8px',
                padding: '20px',
                border: '1px solid #E5E7EB'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '22px',
                  fontWeight: '700',
                  color: '#374151',
                  marginBottom: '12px'
                }}>
                  End Conditions
                </label>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '16px',
                    color: '#6B7280',
                    marginBottom: '8px'
                  }}>
                    End on date
                  </label>
                  <input
                    type="datetime-local"
                    value={endOnDate}
                    min={(() => {
                      const minDate = new Date();
                      minDate.setDate(minDate.getDate() + 7);
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
                      maxWidth: '400px',
                      padding: '12px 16px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      fontSize: '16px',
                      color: '#1F2937',
                      outline: 'none',
                      background: '#FFFFFF'
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Auto-Push Winner - Only shown when Autopilot is ON */}
        {autopilotOn && (
          <div style={{
            background: '#FFFFFF',
            borderRadius: '8px',
            padding: '20px 24px',
            marginBottom: '24px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
          }}>
            <h4 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '8px'
            }}>
              Auto-Push Winner
            </h4>
            <p style={{
              fontSize: '16px',
              color: '#6B7280',
              margin: 0
            }}>
              Automatically updates your PDP with the winning variant!
            </p>
          </div>
        )}

        {/* Error/Success Messages */}
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

        {/* Launch Test Button - Centered */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: '40px'
        }}>
          <button
            onClick={handleLaunchWithConfetti}
            disabled={isLaunchingTest || !canLaunchTest}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '18px 40px',
              background: (isLaunchingTest || !canLaunchTest) ? '#D1D5DB' : '#3B82F6',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '700',
              cursor: (isLaunchingTest || !canLaunchTest) ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              opacity: (isLaunchingTest || !canLaunchTest) ? 0.6 : 1,
              boxShadow: (isLaunchingTest || !canLaunchTest) ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.4)',
              transform: (isLaunchingTest || !canLaunchTest) ? 'none' : 'scale(1)'
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.background = '#2563EB';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.background = '#3B82F6';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
              <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
              <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
            </svg>
            {isLaunchingTest ? 'Launching Test...' : 'Launch Test'}
          </button>
          <p style={{
            fontSize: '14px',
            color: '#6B7280',
            margin: '12px 0 0 0',
            textAlign: 'center'
          }}>
            TryLab will notify you when a winner is found
          </p>
        </div>
      </div>
    </div>
  );
}

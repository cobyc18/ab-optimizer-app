import { Link } from "@remix-run/react";
import React, { useState } from "react";
import ExperimentChart from "./ExperimentChart.jsx";

export default function ExperimentOverview({ experiments, getWidgetTweaks, figmaColors, icons }) {
  const [showEndModal, setShowEndModal] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showModeTooltip, setShowModeTooltip] = useState(false);
  
  const runningTest = experiments.find(exp => exp.status === 'running' || exp.status === 'active' || exp.status === 'live');
  const completedWithWinner = experiments.find(exp => exp.status === 'completed' && exp.winner);
  const spotlightTest = runningTest || completedWithWinner;
  
  if (!spotlightTest) {
    return null;
  }

  // Calculate runtime from startDate
  const calculateRuntime = () => {
    if (!spotlightTest.startDate) return '0h';
    
    const startDate = new Date(spotlightTest.startDate);
    const now = new Date();
    const diffMs = now - startDate;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 24) {
      return `${diffHours}h`;
    } else {
      const days = Math.floor(diffHours / 24);
      const hours = diffHours % 24;
      return `${days}d${hours}h`;
    }
  };
  
  const runtimeDisplay = calculateRuntime();

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString('en-US');
  };

  const atcLift = spotlightTest.analysis?.atc?.expectedRelLift 
    ? (spotlightTest.analysis.atc.expectedRelLift * 100).toFixed(1)
    : null;
  const certainty = spotlightTest.analysis?.atc?.probB 
    ? (spotlightTest.analysis.atc.probB * 100).toFixed(0)
    : spotlightTest.analysis?.purchases?.probB
    ? (spotlightTest.analysis.purchases.probB * 100).toFixed(0)
    : null;

  let descriptionText = '';
  const winnerDeclared = spotlightTest.status === 'completed' && Boolean(spotlightTest.winner);
  if (winnerDeclared && atcLift && certainty) {
    const winningLabel = spotlightTest.winner === 'B' ? 'Variant' : 'Control';
    descriptionText = `${winningLabel} won with a ${Math.abs(atcLift)}% ATC lift at ${certainty}% certainty.`;
  } else if (atcLift && certainty) {
    const isVariantLeading = spotlightTest.analysis?.atc?.probB > 0.5;
    const liftText = isVariantLeading ? `leading ${Math.abs(atcLift)}%` : `trailing ${Math.abs(atcLift)}%`;
    descriptionText = `Variant is ${liftText} ATC with ${certainty}% certainty.`;
  } else {
    descriptionText = winnerDeclared
      ? 'Winner locked based on purchase probability!.'
      : 'Test is running. Collecting data to determine results.';
  }

  const secondaryDescription = winnerDeclared
    ? 'Line up a fresh widget tweak to keep conversion momentum.'
    : 'We suggest keeping the test active for a few more days to reach a more certain conclusion';

  const testNameParts = spotlightTest.name?.split(' VS ') || [spotlightTest.name || 'Experiment'];
  const experimentTitle = testNameParts[0] || spotlightTest.name || 'Experiment';

  // Get current probability from analysis
  const currentProbability = spotlightTest.analysis?.atc?.probB 
    ? Math.round(spotlightTest.analysis.atc.probB * 100)
    : spotlightTest.analysis?.purchases?.probB
    ? Math.round(spotlightTest.analysis.purchases.probB * 100)
    : 0;
  
  // Get threshold percentage based on endResultType
  const getThresholdPercentage = () => {
    const endResultType = spotlightTest.endResultType || 'manual';
    if (endResultType === 'manual') {
      return 95;
    }
    if (endResultType.startsWith('auto-pilot')) {
      const parts = endResultType.split('-');
      if (parts.length >= 3) {
        const mode = parts[2];
        switch (mode) {
          case 'fast': return 55;
          case 'standard': return 70;
          case 'careful': return 95;
          default: return 95;
        }
      }
    }
    return 95; // Default fallback
  };
  
  const thresholdPercentage = getThresholdPercentage();
  const goalPercentage = Math.min(100, Math.max(0, currentProbability)); // Current probability for progress bar fill

  const widgetTweaks = winnerDeclared && spotlightTest.widgetType
    ? getWidgetTweaks(spotlightTest.widgetType)
    : [];

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgb(126, 200, 227) 0%, rgb(126, 200, 227) 75%, rgb(91, 168, 212) 90%, rgb(74, 148, 196) 100%)',
      borderRadius: '20px',
      padding: '40px',
      marginBottom: '40px',
      position: 'relative'
    }}>
      {/* Experiment Overview Text */}
      <div style={{ marginBottom: '30px' }}>
        <p style={{
          fontFamily: 'Geist, sans-serif',
          fontWeight: 500,
          fontSize: '24px',
          color: figmaColors.primaryBlue,
          margin: '0 0 15px 0',
          lineHeight: '32px'
        }}>
          Experiment Overview
        </p>
        <div>
          <span style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 500,
            fontSize: '32px',
            color: figmaColors.darkGray,
            lineHeight: '40px'
          }}>
            {descriptionText}
          </span>
          <span style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 300,
            fontSize: '24px',
            color: figmaColors.darkGray,
            lineHeight: '32px'
          }}>
            {' '}{secondaryDescription}
          </span>
        </div>
      </div>

      {/* Chart Area with X/Y Axes */}
      <div style={{ marginBottom: '10px', position: 'relative', height: '400px' }}>
        <ExperimentChart
          dailyData={spotlightTest.dailyMetrics || []}
          chartWidth={1200}
          chartHeight={340}
          figmaColors={figmaColors}
        />
      </div>

      {/* AutoPilot/Manual Mode - Between chart and test name */}
      {(() => {
        const endResultType = spotlightTest.endResultType || 'manual';
        const isAutopilot = endResultType && endResultType.startsWith('auto-pilot');
        const isManual = endResultType === 'manual';
        
        // Extract mode from endResultType (e.g., "auto-pilot-fast" -> "fast")
        let mode = null;
        if (isAutopilot && endResultType.includes('-')) {
          const parts = endResultType.split('-');
          if (parts.length >= 3) {
            mode = parts[2]; // "fast", "standard", or "careful"
          }
        }
        
        // Capitalize first letter of mode for display
        const modeDisplay = mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : null;
        
        // Get probability for each mode
        const getModeProbability = (mode) => {
          switch (mode) {
            case 'fast': return '55';
            case 'standard': return '70';
            case 'careful': return '95';
            default: return null;
          }
        };
        
        const modeProbability = mode ? getModeProbability(mode) : null;
        
        // Get tooltip text based on mode
        const getTooltipText = () => {
          if (isManual) {
            return "Once the end date is reached, a winner is declared if 95% statistical significance is met.";
          } else if (isAutopilot && mode && modeProbability) {
            return `In '${modeDisplay}' mode, a winner is declared when probability reaches ${modeProbability}% or higher, which typically occurs within ~2 weeks.`;
          }
          return null;
        };
        
        const tooltipText = getTooltipText();
        
        // Only show if autopilot or manual mode
        if (!isAutopilot && !isManual) {
          return null;
        }
        
        return (
          <div style={{ 
            display: 'flex', 
            gap: '15px', 
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            {isAutopilot && (
              <>
                {/* Circular icon with upward zigzag arrow */}
                <div style={{ 
                  width: '28px', 
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#E0F2FE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 12L6 8L8 10L12 4" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <path d="M10 4L12 4L12 6" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
                {/* Lightning bolt icon */}
                <div style={{ 
                  width: '16px', 
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 2L5 9H8L7 14L11 7H8L9 2Z" fill="#3B82F6" stroke="#3B82F6" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: '16px',
                color: figmaColors.primaryBlue,
                margin: 0
              }}>
                {isAutopilot 
                  ? `AutoPilot On${modeDisplay ? ` - ${modeDisplay}` : ''}`
                  : 'Manual Mode'
                }
              </p>
              {tooltipText && (
                <div 
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    cursor: 'help'
                  }}
                  onMouseEnter={() => setShowModeTooltip(true)}
                  onMouseLeave={() => setShowModeTooltip(false)}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: '#6B7280' }}>
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                    <text x="8" y="11" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="bold">?</text>
                  </svg>
                  {showModeTooltip && (
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
                      width: '280px',
                      whiteSpace: 'normal',
                      textAlign: 'left',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                      {tooltipText}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Experiment Title */}
      <div style={{ marginBottom: '30px' }}>
        <p style={{
          fontFamily: 'Geist, sans-serif',
          fontWeight: 500,
          fontSize: '24px',
          color: figmaColors.darkGray,
          margin: '0 0 20px 0',
          lineHeight: '32px'
        }}>
          {experimentTitle}
        </p>
        
        {/* Progress Line */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ width: '100%', height: '4px', backgroundColor: figmaColors.white, borderRadius: '2px', marginBottom: '10px', position: 'relative' }}>
            <div style={{ 
              width: `${goalPercentage}%`, 
              height: '100%', 
              backgroundColor: figmaColors.primaryBlue, 
              borderRadius: '2px',
              position: 'absolute',
              left: 0,
              top: 0
            }} />
            {/* Current probability number on the progress bar */}
            {goalPercentage > 0 && (
              <div style={{
                position: 'absolute',
                left: `${goalPercentage}%`,
                top: '-20px',
                transform: 'translateX(-50%)',
                fontSize: '12px',
                color: figmaColors.darkGray,
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}>
                {goalPercentage}%
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: figmaColors.darkGray, fontFamily: 'Inter, sans-serif' }}>
            <span>Current: {goalPercentage}%</span>
            <span>Goal: {thresholdPercentage}%</span>
          </div>
        </div>
      </div>

      {/* Stats and Action Buttons Row */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        {/* Stats */}
        <div style={{ 
          display: 'flex', 
          gap: '55px', 
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '24px',
              color: figmaColors.darkGray,
              margin: 0,
              lineHeight: '38.704px',
              letterSpacing: '0.344px'
            }}>
              {runtimeDisplay}
            </p>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '16px',
              color: figmaColors.primaryBlue,
              margin: 0
            }}>
              Total Run Time
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '24px',
              color: figmaColors.darkGray,
              margin: 0,
              letterSpacing: '0.344px'
            }}>
              {formatNumber(spotlightTest.variantA || 0)}
            </p>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '16px',
              color: figmaColors.primaryBlue,
              margin: 0
            }}>
              Total Variant A Impressions
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '24px',
              color: figmaColors.darkGray,
              margin: 0,
              letterSpacing: '0.344px'
            }}>
              {formatNumber(spotlightTest.variantB || 0)}
            </p>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '16px',
              color: figmaColors.primaryBlue,
              margin: 0
            }}>
              Total Variant B Impressions
            </p>
          </div>
        </div>

        {/* Action Buttons - Stacked Vertically */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '10px',
          width: '186px',
          height: '105px'
        }}>
          <button 
            onClick={() => setShowEndModal(true)}
            style={{
              backgroundColor: figmaColors.primaryBlue,
              borderRadius: '5px',
              border: 'none',
              padding: '12px 24px',
              cursor: 'pointer',
              height: '48px',
              flex: 1
            }}
          >
            <p style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 500,
              fontSize: '14px',
              color: figmaColors.white,
              margin: 0
            }}>
              End Experiment
            </p>
          </button>
          <button style={{
            backgroundColor: figmaColors.lightBlue,
            border: `1px solid ${figmaColors.primaryBlue}`,
            borderRadius: '5px',
            padding: '12px 24px',
            cursor: 'pointer',
            height: '48px',
            flex: 1
          }}>
            <p style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 500,
              fontSize: '14px',
              color: figmaColors.primaryBlue,
              margin: 0
            }}>
              View Story
            </p>
          </button>
        </div>
      </div>
      
      {/* End Experiment Modal */}
      {showEndModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}
        onClick={() => !isEnding && setShowEndModal(false)}
        >
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '40px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              fontFamily: 'Geist, sans-serif',
              fontWeight: 600,
              fontSize: '24px',
              color: figmaColors.darkGray,
              margin: '0 0 16px 0'
            }}>
              End Experiment?
            </h3>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '16px',
              color: figmaColors.darkGray,
              margin: '0 0 32px 0',
              lineHeight: '24px'
            }}>
              Are you sure you want to end this experiment? This action will stop redirecting visitors to the control or variant and cannot be undone.
            </p>
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowEndModal(false)}
                disabled={isEnding}
                style={{
                  padding: '12px 24px',
                  background: '#FFFFFF',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  cursor: isEnding ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: figmaColors.darkGray,
                  fontFamily: 'Poppins, sans-serif'
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setIsEnding(true);
                  try {
                    const response = await fetch('/api/end-experiment', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        testId: spotlightTest.id
                      })
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                      setShowEndModal(false);
                      window.location.reload(); // Reload to show updated status
                    } else {
                      alert(result.error || 'Failed to end experiment');
                      setIsEnding(false);
                    }
                  } catch (error) {
                    console.error('Error ending experiment:', error);
                    alert('Failed to end experiment. Please try again.');
                    setIsEnding(false);
                  }
                }}
                disabled={isEnding}
                style={{
                  padding: '12px 24px',
                  background: figmaColors.orange || '#ef9362',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isEnding ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#FFFFFF',
                  fontFamily: 'Poppins, sans-serif'
                }}
              >
                {isEnding ? 'Ending...' : 'End Experiment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {winnerDeclared && widgetTweaks.length > 0 && (
        <div style={{ marginTop: '35px' }}>
          <p style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 500,
            fontSize: '20px',
            color: figmaColors.darkGray,
            margin: '0 0 16px 0'
          }}>
            Keep Momentum Going
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px'
          }}>
            {widgetTweaks.map((tweak) => (
              <div key={tweak.id} style={{
                backgroundColor: figmaColors.white,
                borderRadius: '16px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
              }}>
                <div>
                  <p style={{
                    fontFamily: 'Geist, sans-serif',
                    fontWeight: 500,
                    fontSize: '16px',
                    margin: 0,
                    color: figmaColors.darkGray
                  }}>
                    {tweak.title}
                  </p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '13px',
                    margin: '4px 0 0 0',
                    color: figmaColors.lightGray,
                    lineHeight: '18px'
                  }}>
                    {tweak.description}
                  </p>
                </div>
                {spotlightTest.widgetType === 'simple-text-badge' && (
                  <div style={{
                    borderRadius: '12px',
                    padding: '14px',
                    backgroundColor: tweak.previewColors?.background || '#f5f5f0',
                    color: tweak.previewColors?.text || '#1a5f5f',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    minHeight: '72px',
                    display: 'flex',
                    alignItems: 'center',
                    border: `2px solid ${tweak.previewColors?.ribbon || '#dc2626'}`
                  }}>
                    {tweak.badgeText}
                  </div>
                )}
                {spotlightTest.widgetType === 'live-visitor-count' && (
                  <div style={{
                    borderRadius: '12px',
                    padding: '12px',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '20px', fontWeight: 600 }}>
                      {tweak.previewText?.replace(/\D/g, '') || `${tweak.settings?.countMin || 40}`}
                    </span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: figmaColors.lightGray }}>
                      {tweak.previewText || tweak.settings?.desktopText}
                    </span>
                  </div>
                )}
                <Link
                  to="/app/ab-tests"
                  style={{
                    backgroundColor: figmaColors.primaryBlue,
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    color: figmaColors.white,
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    display: 'inline-block'
                  }}
                >
                  Launch This Idea
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


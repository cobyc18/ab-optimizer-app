import { Link } from "@remix-run/react";
import React from "react";

export default function ExperimentOverview({ experiments, getWidgetTweaks, figmaColors, icons }) {
  const runningTest = experiments.find(exp => exp.status === 'running' || exp.status === 'active' || exp.status === 'live');
  const completedWithWinner = experiments.find(exp => exp.status === 'completed' && exp.winner);
  const spotlightTest = runningTest || completedWithWinner;
  
  if (!spotlightTest) {
    return null;
  }

  const runtimeMatch = spotlightTest.runtime?.match(/(\d+)d/);
  const days = runtimeMatch ? parseInt(runtimeMatch[1], 10) : 0;
  const hours = days * 24;
  const runtimeDisplay = hours >= 24 ? `${days} d` : `${hours} h`;

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

  const goalPercentage = spotlightTest.analysis?.atc?.probB 
    ? Math.min(95, Math.max(50, Math.round(spotlightTest.analysis.atc.probB * 100)))
    : 80;

  const widgetTweaks = winnerDeclared && spotlightTest.widgetType
    ? getWidgetTweaks(spotlightTest.widgetType)
    : [];

  return (
    <div style={{
      backgroundColor: figmaColors.lightBlue,
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
      <div style={{ marginBottom: '30px', position: 'relative', height: '300px' }}>
        {/* Y-Axis Labels */}
        <div style={{
          position: 'absolute',
          left: '20px',
          top: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '55px',
          alignItems: 'center',
          fontSize: '18px',
          color: 'rgba(21,21,21,0.7)',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 400,
          height: '240px',
          justifyContent: 'space-between'
        }}>
          <p style={{ margin: 0 }}>5</p>
          <p style={{ margin: 0 }}>4</p>
          <p style={{ margin: 0 }}>3</p>
          <p style={{ margin: 0 }}>2</p>
          <p style={{ margin: 0 }}>1</p>
          <p style={{ margin: 0 }}>0</p>
        </div>
        
        {/* X-Axis Labels */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '70px',
          alignItems: 'center',
          fontSize: '18px',
          color: 'rgba(21,21,21,0.7)',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 400
        }}>
          <p style={{ margin: 0 }}>JAN</p>
          <p style={{ margin: 0 }}>FEB</p>
          <p style={{ margin: 0 }}>MAR</p>
          <p style={{ margin: 0 }}>APR</p>
          <p style={{ margin: 0 }}>MAY</p>
          <p style={{ margin: 0 }}>JUN</p>
          <p style={{ margin: 0 }}>JUL</p>
          <p style={{ margin: 0 }}>AUG</p>
          <p style={{ margin: 0 }}>SEP</p>
          <p style={{ margin: 0 }}>OCT</p>
          <p style={{ margin: 0 }}>NOV</p>
          <p style={{ margin: 0 }}>DEC</p>
        </div>
      </div>

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
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: figmaColors.darkGray, fontFamily: 'Inter, sans-serif' }}>
            <span>Goal: {goalPercentage}%</span>
            <span>{goalPercentage}%</span>
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
              Variant A
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
              Variant B
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
          <button style={{
            backgroundColor: figmaColors.primaryBlue,
            borderRadius: '5px',
            border: 'none',
            padding: '12px 24px',
            cursor: 'pointer',
            height: '48px',
            flex: 1
          }}>
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
      
      {/* Legend */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#3d3af3', borderRadius: '4px', width: '16px', height: '16px' }} />
          <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontSize: '16px', color: figmaColors.themeDark, margin: 0 }}>
            Variant
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ backgroundColor: figmaColors.orange, borderRadius: '4px', width: '16px', height: '16px' }} />
          <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontSize: '16px', color: figmaColors.themeDark, margin: 0 }}>
            Control
          </p>
        </div>
      </div>
      
      {/* AutoPilot */}
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
        <div style={{ width: '28px', height: '28px' }}>
          <img alt="Graph" src={icons.graph} style={{ width: '100%', height: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ 
            width: '16px', 
            height: '16px',
            backgroundColor: figmaColors.primaryBlue,
            borderRadius: '50%'
          }}></div>
          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: '16px',
            color: figmaColors.primaryBlue,
            margin: 0
          }}>
            AutoPilot On
          </p>
        </div>
      </div>

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


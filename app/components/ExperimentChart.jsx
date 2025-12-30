import React, { useMemo } from 'react';

/**
 * Calculate linear regression for a set of points
 * Returns { slope, intercept, points: [x, y] for regression line }
 */
function calculateRegression(dataPoints) {
  if (dataPoints.length === 0) return { slope: 0, intercept: 0, points: [] };
  
  const n = dataPoints.length;
  const sumX = dataPoints.reduce((sum, p) => sum + p.x, 0);
  const sumY = dataPoints.reduce((sum, p) => sum + p.y, 0);
  const sumXY = dataPoints.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumXX = dataPoints.reduce((sum, p) => sum + p.x * p.x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Generate regression line points
  const minX = Math.min(...dataPoints.map(p => p.x));
  const maxX = Math.max(...dataPoints.map(p => p.x));
  const points = [
    { x: minX, y: slope * minX + intercept },
    { x: maxX, y: slope * maxX + intercept }
  ];
  
  return { slope, intercept, points };
}

export default function ExperimentChart({ 
  dailyData, 
  chartWidth = 1200, 
  chartHeight = 240,
  figmaColors 
}) {
  // Calculate chart dimensions and padding
  const padding = { top: 20, right: 50, bottom: 40, left: 50 }; // Left padding for Y-axis labels
  const xAxisOffset = 5; // Minimal space before day 1 (so intersection is at 0 but 0 is not displayed)
  const graphStartX = padding.left + xAxisOffset; // Where the graph area actually starts (Y-axis line position)
  const plotWidth = chartWidth - graphStartX - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  
  // Fixed Y-axis: 0% to 40% with 5% increments (inverted: 0% at bottom, 40% at top)
  const maxRate = 0.40; // 40%
  const yAxisIncrement = 0.05; // 5%
  const maxDays = 14; // Fixed to 14 days
  
  // Process data and calculate regression
  const { controlPoints, variantPoints, controlRegression, variantRegression, maxDay } = useMemo(() => {
    if (!dailyData || dailyData.length === 0) {
      return {
        controlPoints: [],
        variantPoints: [],
        controlRegression: { points: [] },
        variantRegression: { points: [] },
        maxDay: 1
      };
    }
    
    // Extract points for control and variant, sorted by day number
    const controlData = dailyData
      .filter(d => d.variant === 'control')
      .map(d => ({ x: d.dayNumber, y: d.addToCartRate }))
      .sort((a, b) => a.x - b.x); // Sort by day number
    
    const variantData = dailyData
      .filter(d => d.variant === 'variant')
      .map(d => ({ x: d.dayNumber, y: d.addToCartRate }))
      .sort((a, b) => a.x - b.x); // Sort by day number
    
    // Calculate regression lines
    const controlReg = calculateRegression(controlData);
    const variantReg = calculateRegression(variantData);
    
    // Find max day for scaling
    const allDays = dailyData.map(d => d.dayNumber);
    const maxDay = Math.max(...allDays, 1);
    
    return {
      controlPoints: controlData,
      variantPoints: variantData,
      controlRegression: controlReg,
      variantRegression: variantReg,
      maxDay
    };
  }, [dailyData]);
  
  // Convert data point to SVG coordinates
  // X: Graph starts at graphStartX, day 1 is at the start of the plot area
  const toSVGX = (x) => graphStartX + ((x - 1) / (maxDays - 1)) * plotWidth;
  // Y: Inverted - 0% at bottom, 40% at top
  const toSVGY = (y) => padding.top + plotHeight - (y / maxRate) * plotHeight;
  
  // Generate Y-axis labels (0% to 40% with 5% increments) - inverted order for display
  const yAxisLabels = useMemo(() => {
    const labels = [];
    for (let i = 8; i >= 0; i--) { // 40, 35, 30, 25, 20, 15, 10, 5, 0 (inverted)
      const value = i * yAxisIncrement;
      labels.push(value.toFixed(2));
    }
    return labels;
  }, []);
  
  // Generate X-axis labels (days 1-14)
  const xAxisLabels = useMemo(() => {
    const labels = [];
    for (let i = 1; i <= maxDays; i++) {
      labels.push(i);
    }
    return labels;
  }, []);
  
  // Build SVG path for data points
  const buildPath = (points) => {
    if (points.length === 0) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSVGX(p.x)} ${toSVGY(p.y)}`)
      .join(' ');
  };
  
  // Build SVG path for regression line
  const buildRegressionPath = (regression) => {
    if (!regression.points || regression.points.length === 0) return '';
    const [p1, p2] = regression.points;
    return `M ${toSVGX(p1.x)} ${toSVGY(p1.y)} L ${toSVGX(p2.x)} ${toSVGY(p2.y)}`;
  };
  
  return (
    <div style={{ position: 'relative', width: '100%', height: `${chartHeight}px` }}>
      {/* Legend - Above chart */}
      <div style={{
        position: 'absolute',
        top: '-27px',
        right: '20px',
        display: 'flex',
        gap: '20px',
        alignItems: 'center',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#3d3af3', borderRadius: '4px', width: '16px', height: '16px' }} />
          <p style={{ 
            fontFamily: 'Poppins, sans-serif', 
            fontWeight: 400, 
            fontSize: '16px', 
            color: figmaColors?.themeDark || '#464255', 
            margin: 0 
          }}>
            Variant
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ backgroundColor: figmaColors?.orange || '#ef9362', borderRadius: '4px', width: '16px', height: '16px' }} />
          <p style={{ 
            fontFamily: 'Poppins, sans-serif', 
            fontWeight: 400, 
            fontSize: '16px', 
            color: figmaColors?.themeDark || '#464255', 
            margin: 0 
          }}>
            Control
          </p>
        </div>
      </div>
      
      <svg 
        width={chartWidth} 
        height={chartHeight}
        style={{ 
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)'
        }}
      >
        {/* Grid lines */}
        {yAxisLabels.map((label, i) => {
          // Inverted: 0% at bottom (i=8), 40% at top (i=0)
          const y = padding.top + (i / (yAxisLabels.length - 1)) * plotHeight;
          return (
            <line
              key={`grid-y-${i}`}
              x1={graphStartX}
              y1={y}
              x2={graphStartX + plotWidth}
              y2={y}
              stroke="#e6e6e6"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          );
        })}
        
        {/* Y-axis - aligned with day 1 position */}
        <line
          x1={graphStartX}
          y1={padding.top}
          x2={graphStartX}
          y2={padding.top + plotHeight}
          stroke="#FFFFFF"
          strokeWidth="2"
        />
        
        {/* X-axis - starts at day 1 position */}
        <line
          x1={graphStartX}
          y1={padding.top + plotHeight}
          x2={graphStartX + plotWidth}
          y2={padding.top + plotHeight}
          stroke="#FFFFFF"
          strokeWidth="2"
        />
        
        {/* Control regression line (orange, dashed) */}
        {controlRegression.points.length > 0 && (
          <path
            d={buildRegressionPath(controlRegression)}
            stroke={figmaColors?.orange || '#ef9362'}
            strokeWidth="2"
            strokeDasharray="4,4"
            fill="none"
            opacity="0.7"
          />
        )}
        
        {/* Variant regression line (blue, dashed) */}
        {variantRegression.points.length > 0 && (
          <path
            d={buildRegressionPath(variantRegression)}
            stroke="#3d3af3"
            strokeWidth="2"
            strokeDasharray="4,4"
            fill="none"
            opacity="0.7"
          />
        )}
        
        {/* Control data line (orange, solid) */}
        {controlPoints.length > 0 && (
          <path
            d={buildPath(controlPoints)}
            stroke={figmaColors?.orange || '#ef9362'}
            strokeWidth="3"
            fill="none"
          />
        )}
        
        {/* Variant data line (blue, solid) */}
        {variantPoints.length > 0 && (
          <path
            d={buildPath(variantPoints)}
            stroke="#3d3af3"
            strokeWidth="3"
            fill="none"
          />
        )}
        
        {/* Control data points */}
        {controlPoints.map((point, i) => (
          <circle
            key={`control-point-${i}`}
            cx={toSVGX(point.x)}
            cy={toSVGY(point.y)}
            r="4"
            fill={figmaColors?.orange || '#ef9362'}
          />
        ))}
        
        {/* Variant data points */}
        {variantPoints.map((point, i) => (
          <circle
            key={`variant-point-${i}`}
            cx={toSVGX(point.x)}
            cy={toSVGY(point.y)}
            r="4"
            fill="#3d3af3"
          />
        ))}
      </svg>
      
      {/* Y-axis labels - Show as percentages */}
      <div style={{
        position: 'absolute',
        left: '20px',
        top: `${padding.top}px`,
        display: 'flex',
        flexDirection: 'column',
        height: `${plotHeight}px`,
        justifyContent: 'space-between',
        fontSize: '18px',
        color: 'rgba(21,21,21,0.7)',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 400
      }}>
        {yAxisLabels.map((label, i) => {
          const percentage = (parseFloat(label) * 100).toFixed(0);
          return (
            <p key={`y-label-${i}`} style={{ margin: 0, textAlign: 'right', width: '50px' }}>
              {percentage}%
            </p>
          );
        })}
      </div>
      
      {/* X-axis labels - Days 1-14 with spacing */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: `${graphStartX}px`,
        width: `${plotWidth}px`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '14px',
        color: 'rgba(21,21,21,0.7)',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 400
      }}>
        {xAxisLabels.map((day, i) => {
          // Calculate position for each day label (evenly spaced across plotWidth)
          // Day 1 should be at the start (position 0), day 14 at the end
          // Add offset to push labels to the right
          const labelOffset = 100; // Push all labels to the right
          const dayPosition = (i / (xAxisLabels.length - 1)) * plotWidth + labelOffset;
          return (
            <p 
              key={`x-label-${i}`} 
              style={{ 
                margin: 0, 
                textAlign: 'center',
                position: 'absolute',
                left: `${dayPosition}px`,
                transform: 'translateX(-50%)'
              }}
            >
              {day}
            </p>
          );
        })}
      </div>
    </div>
  );
}


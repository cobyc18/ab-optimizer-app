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
  const padding = { top: 20, right: 50, bottom: 40, left: 60 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  
  // Process data and calculate regression
  const { controlPoints, variantPoints, controlRegression, variantRegression, maxDay, maxRate } = useMemo(() => {
    if (!dailyData || dailyData.length === 0) {
      return {
        controlPoints: [],
        variantPoints: [],
        controlRegression: { points: [] },
        variantRegression: { points: [] },
        maxDay: 1,
        maxRate: 0.05
      };
    }
    
    // Extract points for control and variant
    const controlData = dailyData
      .filter(d => d.variant === 'control')
      .map(d => ({ x: d.dayNumber, y: d.addToCartRate }));
    
    const variantData = dailyData
      .filter(d => d.variant === 'variant')
      .map(d => ({ x: d.dayNumber, y: d.addToCartRate }));
    
    // Calculate regression lines
    const controlReg = calculateRegression(controlData);
    const variantReg = calculateRegression(variantData);
    
    // Find max values for scaling
    const allDays = dailyData.map(d => d.dayNumber);
    const allRates = dailyData.map(d => d.addToCartRate);
    const maxDay = Math.max(...allDays, 1);
    const maxRate = Math.max(...allRates, 0.05); // Minimum 5% for visibility
    
    return {
      controlPoints: controlData,
      variantPoints: variantData,
      controlRegression: controlReg,
      variantRegression: variantReg,
      maxDay,
      maxRate: Math.ceil(maxRate * 100) / 100 // Round up to 2 decimals
    };
  }, [dailyData]);
  
  // Convert data point to SVG coordinates
  const toSVGX = (x) => padding.left + (x / maxDay) * plotWidth;
  const toSVGY = (y) => padding.top + plotHeight - (y / maxRate) * plotHeight;
  
  // Generate Y-axis labels (0 to maxRate)
  const yAxisLabels = useMemo(() => {
    const numLabels = 6;
    const labels = [];
    for (let i = 0; i <= numLabels; i++) {
      const value = (maxRate / numLabels) * i;
      labels.push(value.toFixed(2));
    }
    return labels;
  }, [maxRate]);
  
  // Generate X-axis labels (day numbers)
  const xAxisLabels = useMemo(() => {
    if (maxDay <= 0) return [];
    const numLabels = Math.min(maxDay, 12); // Max 12 labels
    const step = Math.max(1, Math.ceil(maxDay / numLabels));
    const labels = [];
    for (let i = 1; i <= maxDay; i += step) {
      labels.push(i);
    }
    if (labels[labels.length - 1] !== maxDay) {
      labels.push(maxDay);
    }
    return labels;
  }, [maxDay]);
  
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
          const y = padding.top + plotHeight - (i / (yAxisLabels.length - 1)) * plotHeight;
          return (
            <line
              key={`grid-y-${i}`}
              x1={padding.left}
              y1={y}
              x2={padding.left + plotWidth}
              y2={y}
              stroke="#e6e6e6"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          );
        })}
        
        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + plotHeight}
          stroke="#e6e6e6"
          strokeWidth="2"
        />
        
        {/* X-axis */}
        <line
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={padding.left + plotWidth}
          y2={padding.top + plotHeight}
          stroke="#e6e6e6"
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
          const percentage = (parseFloat(label) * 100).toFixed(1);
          return (
            <p key={`y-label-${i}`} style={{ margin: 0, textAlign: 'right', width: '50px' }}>
              {percentage}%
            </p>
          );
        })}
      </div>
      
      {/* X-axis labels */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: `${plotWidth / (xAxisLabels.length - 1 || 1)}px`,
        alignItems: 'center',
        fontSize: '18px',
        color: 'rgba(21,21,21,0.7)',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 400,
        width: `${plotWidth}px`,
        marginLeft: `${padding.left}px`
      }}>
        {xAxisLabels.map((day, i) => (
          <p key={`x-label-${i}`} style={{ margin: 0, textAlign: 'center', flex: 1 }}>
            {day}
          </p>
        ))}
      </div>
    </div>
  );
}


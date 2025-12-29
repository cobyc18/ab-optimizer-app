import React from 'react';
import { useNavigate } from "@remix-run/react";
import freeShippingBadgeImage from "../assets/free-shipping-badge.png";
import moneyBackGuaranteeImage from "../assets/money-back-guarantee.png";
import addToCartImage from "../assets/add-to-cart.png";

// Figma Design Variables - matching app.ab-tests.jsx
const figmaColors = {
  gray: "#e6e6e6",
  primaryBlue: "#0038ff",
  darkGray: "#151515"
};

/**
 * ConversionPlayCard Component
 * 
 * Displays a conversion play card with exact styling from the A/B flow.
 * Used in both the A/B flow (with drag/swipe) and dashboard carousel.
 * 
 * @param {Object} widget - The conversion play widget data
 * @param {boolean} isSelected - Whether this card is currently selected
 * @param {Object} style - Additional inline styles to apply (for positioning, transforms, etc.)
 * @param {Function} onClick - Click handler (optional)
 * @param {Object} dragHandlers - Drag event handlers (optional, for A/B flow)
 */
export default function ConversionPlayCard({ 
  widget, 
  isSelected = false, 
  style = {},
  onClick,
  dragHandlers = {},
  dashboardMode = false, // New prop for dashboard styling
  onTryNow // Callback for "Try now" button click
}) {
  const navigate = useNavigate();
  const cardStyle = {
    minWidth: '320px',
    width: dashboardMode ? '360px' : undefined, // Fixed width for dashboard (wider to fit longer titles)
    backgroundColor: dashboardMode ? '#D8D8D8' : figmaColors.gray, // Darker grey for dashboard
    border: dashboardMode ? 'none' : (isSelected ? `3px solid ${figmaColors.primaryBlue}` : `1px solid ${figmaColors.primaryBlue}`),
    borderRadius: '24px',
    padding: '40px',
    margin: '0',
    boxSizing: 'border-box',
    overflow: 'visible',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    alignItems: 'center',
    cursor: onClick ? 'pointer' : 'default',
    userSelect: 'none',
    position: 'relative',
    ...style
  };

  return (
    <div
      {...dragHandlers}
      onClick={onClick}
      style={cardStyle}
    >
      {/* Checkmark icon - top right */}
      {isSelected && (
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
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: dashboardMode ? '30px' : '50px', alignItems: 'center', width: '100%', boxSizing: 'border-box', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
          {/* Widget Preview - Image Section */}
          <div style={{ 
            width: '280px', 
            height: '200px', 
            borderRadius: '10px', 
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}>
            {widget.utility === 'Free Shipping Badge' ? (
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
            ) : widget.utility === 'How Many in Cart' ? (
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
            ) : widget.utility === 'Returns Guarantee Badge' ? (
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
              {widget.utility}
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
              {(Array.isArray(widget.style) ? widget.style : [widget.style]).map((tag, tagIndex) => (
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
              {widget.rationale}
            </p>
          </div>
        </div>
        
        {/* Try Now Button - Only show in dashboard mode */}
        {dashboardMode && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent card onClick from firing
              console.log('🔵 Try Now clicked for widget:', widget);
              if (onTryNow) {
                console.log('🔵 Using custom onTryNow handler');
                onTryNow(widget);
              } else {
                // Default navigation to A/B flow with widget ID, skip to step 2 (product selection, which is currentStep=1)
                const url = `/app/ab-tests?widgetId=${widget.id}&step=1`;
                console.log('🔵 Navigating to:', url);
                navigate(url);
              }
            }}
            style={{
              backgroundColor: '#FFFFFF',
              color: figmaColors.primaryBlue,
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              width: '100%',
              transition: 'all 0.2s ease',
              marginTop: '10px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = figmaColors.primaryBlue;
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.color = figmaColors.primaryBlue;
            }}
          >
            Try now
          </button>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ConversionPlayCard from "../components/ConversionPlayCard.jsx";
import { getFilteredConversionPlays, getVisibleCards } from "./app.ab-tests.shared.jsx";
import { abTestIdeas } from "../data/abTestIdeas.js";

export default function Step0({
  selectedGoal,
  setSelectedGoal,
  currentWidgetIndex,
  setCurrentWidgetIndex,
  selectedConversionPlayIndex,
  setSelectedConversionPlayIndex,
  isAnimating,
  swipeDirection,
  setIsAnimating,
  setSwipeDirection,
  onSwipeLike, // Callback when user swipes right/selects (moves to step 1)
  applyWidgetIdeaSelection // Function to apply widget selection
}) {
  // Drag state (local to step 0)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragCurrent, setDragCurrent] = useState({ x: 0, y: 0 });
  
  // Use refs to track drag values to avoid stale closures
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragCurrentRef = useRef({ x: 0, y: 0 });

  const filteredWidgets = getFilteredConversionPlays(selectedGoal);
  const visibleCards = getVisibleCards(currentWidgetIndex, selectedGoal);

  // Drag handlers
  const handleDragMove = useCallback((e) => {
    if (!isDragging || isAnimating) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragCurrentRef.current = { x: clientX, y: clientY };
    setDragCurrent({ x: clientX, y: clientY });
  }, [isDragging, isAnimating]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging || isAnimating) return;
    
    // Use refs to get the most current values
    const current = dragCurrentRef.current;
    const start = dragStartRef.current;
    const deltaX = current.x - start.x;
    const deltaY = current.y - start.y;
    const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const threshold = 50; // Minimum drag distance to trigger navigation
    
    if (dragDistance > threshold) {
      // Determine direction based on horizontal movement
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Only move one widget at a time
        const filteredWidgets = getFilteredConversionPlays(selectedGoal);
        if (deltaX > 0) {
          // Dragged right - go to next widget (only one step)
          setCurrentWidgetIndex(prevIndex => {
            if (prevIndex < filteredWidgets.length - 1) {
              return prevIndex + 1;
            } else {
              return 0; // Wrap around
            }
          });
        } else {
          // Dragged left - go to previous widget (only one step)
          setCurrentWidgetIndex(prevIndex => {
            if (prevIndex > 0) {
              return prevIndex - 1;
            } else {
              return filteredWidgets.length - 1; // Wrap around
            }
          });
        }
      }
    }
    
    setIsDragging(false);
    setDragStart({ x: 0, y: 0 });
    setDragCurrent({ x: 0, y: 0 });
    dragStartRef.current = { x: 0, y: 0 };
    dragCurrentRef.current = { x: 0, y: 0 };
  }, [isDragging, isAnimating, selectedGoal]);

  const handleDragStart = (e) => {
    if (isAnimating) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const startPos = { x: clientX, y: clientY };
    setIsDragging(true);
    setDragStart(startPos);
    setDragCurrent(startPos);
    dragStartRef.current = startPos;
    dragCurrentRef.current = startPos;
  };

  // Add document-level event listeners for better drag handling
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove, { passive: false });
      document.addEventListener('touchend', handleDragEnd);

      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('touchmove', handleDragMove);
        document.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Clear selection when navigating to a different widget (step0-specific)
  useEffect(() => {
    setSelectedConversionPlayIndex(null);
  }, [currentWidgetIndex, setSelectedConversionPlayIndex]);

  // Reset widget index when goal changes (step0-specific)
  useEffect(() => {
    setCurrentWidgetIndex(0);
    setSelectedConversionPlayIndex(null);
  }, [selectedGoal, setCurrentWidgetIndex, setSelectedConversionPlayIndex]);

  // Handle swipe function (for step 0)
  const handleSwipe = (direction) => {
    if (isAnimating || isDragging) return;
    
    setIsAnimating(true);
    setSwipeDirection(direction);
    
    if (direction === 'like') {
      const filteredWidgets = getFilteredConversionPlays(selectedGoal);
      if (filteredWidgets.length === 0 || currentWidgetIndex >= filteredWidgets.length) {
        setIsAnimating(false);
        setSwipeDirection(null);
        return;
      }
      const selectedWidget = filteredWidgets[currentWidgetIndex];
      if (!selectedWidget) {
        setIsAnimating(false);
        setSwipeDirection(null);
        return;
      }
      
      // Apply widget selection and call callback to move to step 1
      if (applyWidgetIdeaSelection) {
        applyWidgetIdeaSelection(selectedWidget);
      }
      
      setTimeout(() => {
        if (onSwipeLike) {
          onSwipeLike();
        }
        setIsAnimating(false);
        setSwipeDirection(null);
      }, 400);
    } else {
      // Swipe left - move to next widget
      setTimeout(() => {
        const filteredWidgets = getFilteredConversionPlays(selectedGoal);
        if (currentWidgetIndex < filteredWidgets.length - 1) {
          setCurrentWidgetIndex(currentWidgetIndex + 1);
        } else {
          setCurrentWidgetIndex(0);
        }
        setIsAnimating(false);
        setSwipeDirection(null);
      }, 400);
    }
  };

  return (
    <div style={{
      animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      transform: 'translateX(0)',
      opacity: 1,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'center',
      gap: '24px',
      padding: '40px 20px',
      minHeight: '500px'
    }}>
      {/* Goal Selection Card - Left Side */}
      <div style={{
        background: 'linear-gradient(135deg, rgb(126, 200, 227) 0%, rgb(91, 168, 212) 50%, rgb(74, 148, 196) 100%)',
        borderRadius: '16px',
        padding: '40px',
        width: '100%',
        maxWidth: '600px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        minHeight: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Title */}
        <p style={{
          fontSize: '12px',
          fontWeight: '700',
          color: '#6B7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          margin: '0 0 16px 0'
        }}>
          SELECT YOUR GOAL
        </p>
        
        {/* Main Question */}
        <h3 style={{
          fontSize: '32px',
          fontWeight: '700',
          color: '#FFFFFF',
          margin: '0 0 32px 0',
          lineHeight: '1.2'
        }}>
          What do you want to improve?
        </h3>

        {/* Goal Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {[
            { 
              goal: 'Trust', 
              icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231F2937' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/%3E%3Cpath d='M9 12l2 2 4-4'/%3E%3C/svg%3E",
              description: 'Make shoppers feel safe, confident, and comfortable buying.'
            },
            { 
              goal: 'Urgency', 
              icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231F2937' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpolyline points='12 6 12 12 16 14'/%3E%3Cpath d='M8 12l4 4'/%3E%3C/svg%3E",
              description: 'Create a feeling that buying NOW is better than later.'
            },
            { 
              goal: 'Scarcity', 
              icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231F2937' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z'/%3E%3Cline x1='3' y1='6' x2='21' y2='6'/%3E%3Cpath d='M16 10a4 4 0 0 1-8 0'/%3E%3C/svg%3E",
              description: 'Make shoppers feel the product may run out.'
            },
            { 
              goal: 'Social Proof', 
              icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231F2937' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='9' cy='7' r='4'/%3E%3Cpath d='M23 21v-2a4 4 0 0 0-3-3.87'/%3E%3Cpath d='M16 3.13a4 4 0 0 1 0 7.75'/%3E%3C/svg%3E",
              description: 'Show that others validate the product.'
            },
            { 
              goal: 'Value Perception', 
              icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231F2937' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='12' y1='1' x2='12' y2='23'/%3E%3Cpath d='M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'/%3E%3C/svg%3E",
              description: 'Make the offer stupidly easy to understand.'
            }
          ].map(({ goal, icon, description }) => {
            const isSelected = selectedGoal === goal;
            
            return (
              <button
                key={goal}
                onClick={() => {
                  setSelectedGoal(goal);
                }}
                style={{
                  backgroundColor: selectedGoal && !isSelected ? 'rgba(59, 130, 246, 0.08)' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '32px 36px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: selectedGoal && !isSelected ? 'rgba(31, 41, 55, 0.6)' : '#1F2937',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: selectedGoal && !isSelected ? '0 1px 2px rgba(0, 0, 0, 0.03)' : '0 2px 4px rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  width: '100%',
                  minHeight: '90px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  if (!selectedGoal || isSelected) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selectedGoal || isSelected) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = selectedGoal && !isSelected ? '0 1px 2px rgba(0, 0, 0, 0.03)' : '0 2px 4px rgba(0, 0, 0, 0.05)';
                  }
                }}
              >
                {/* Icon with subtle blue circular background */}
                <div style={{
                  width: '48px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  backgroundColor: selectedGoal && !isSelected ? 'rgba(59, 130, 246, 0.15)' : '#E0F2FE',
                  borderRadius: '50%',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                  <img src={icon} alt="" style={{ 
                    width: '28px', 
                    height: '28px',
                    opacity: selectedGoal && !isSelected ? 0.7 : 1,
                    transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }} />
                </div>
              
              {/* Text Content */}
              <div style={{ flex: 1 }}>
                <p style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: '600',
                  color: selectedGoal && !isSelected ? '#FFFFFF' : '#1F2937',
                  marginBottom: '6px',
                  transition: 'color 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                  {goal}
                </p>
                <p style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: '400',
                  color: selectedGoal && !isSelected ? '#FFFFFF' : '#6B7280',
                  lineHeight: '1.4',
                  transition: 'color 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                  {description}
                </p>
              </div>
            </button>
            );
          })}
        </div>
      </div>

      {/* Tinder Swiper - Right Side (appears when goal is selected) */}
      {selectedGoal && (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '40px',
          width: '100%',
          maxWidth: '600px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
          boxSizing: 'border-box',
          overflow: 'visible',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}>
          {/* Title with Arrows */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px'
          }}>
            <p style={{
              fontSize: '12px',
              fontWeight: '700',
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              margin: 0
            }}>
              Pick an idea to test with
            </p>
            
            {/* Navigation Arrows */}
            <div style={{ display: 'flex', gap: '11px', alignItems: 'center' }}>
              {/* Left Arrow - Simple gray chevron */}
              <div 
                onClick={() => {
                  const filteredWidgets = getFilteredConversionPlays(selectedGoal);
                  setCurrentWidgetIndex(prevIndex => {
                    if (prevIndex === 0) {
                      return filteredWidgets.length - 1; // Wrap to last widget
                    }
                    return prevIndex - 1;
                  });
                }}
                style={{
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18l-6-6 6-6" stroke="#D1D5DB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              
              {/* Right Arrow - Same size as left */}
              <div 
                onClick={() => {
                  const filteredWidgets = getFilteredConversionPlays(selectedGoal);
                  setCurrentWidgetIndex(prevIndex => {
                    if (prevIndex === filteredWidgets.length - 1) {
                      return 0; // Wrap to first widget
                    }
                    return prevIndex + 1;
                  });
                }}
                style={{
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="#D1D5DB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          <div style={{
            position: 'relative',
            minWidth: '320px',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            flex: '0 0 auto',
            boxSizing: 'border-box',
            overflow: 'visible',
            minHeight: '600px',
            padding: '32px 0 120px 0'
          }}>
            {/* Render stacked cards - show cards behind when dragging */}
            {visibleCards.map(({ index, widget, stackIndex }) => {
              if (!widget) return null;

              const isCurrent = stackIndex === 0;
              // Higher z-index for cards on top
              const zIndex = 100 - stackIndex;
              
              // Calculate drag offset for current card only
              let dragOffsetX = 0;
              let dragOffsetY = 0;
              
              // Calculate deltaX for showing widget behind during drag
              const deltaX = isDragging ? (dragCurrent.x - dragStart.x) : 0;
              const showNextWidget = isDragging && Math.abs(deltaX) > 20;
              
              if (isCurrent && isDragging) {
                dragOffsetX = dragCurrent.x - dragStart.x;
                dragOffsetY = dragCurrent.y - dragStart.y;
              }
              
              // Determine which widget to show behind when dragging
              let shouldShow = false;
              if (isCurrent) {
                shouldShow = true; // Always show current
              } else if (showNextWidget) {
                // getVisibleCards puts widgets in order: current (0), next (1), next+1 (2), ..., prev (last)
                if (deltaX > 0) {
                  // Dragging right - show next widget (which is at stackIndex 1)
                  shouldShow = stackIndex === 1;
                } else if (deltaX < 0) {
                  // Dragging left - show previous widget (which is at the last stackIndex)
                  // Calculate total number of filtered widgets
                  const totalFilteredWidgets = filteredWidgets.length;
                  const lastStackIndex = totalFilteredWidgets - 1; // Last widget is at this stackIndex
                  shouldShow = stackIndex === lastStackIndex;
                }
              }
              
              // Perfect alignment - no offset for cards behind when not dragging
              // Center the card: left: 50% then translateX(-50%) to center, plus drag offset
              // Use percentage for proper centering regardless of card width
              const baseTranslateX = '-50%';
              const translateX = isCurrent 
                ? `calc(${baseTranslateX} + ${dragOffsetX}px)` 
                : baseTranslateX;
              const translateY = isCurrent ? dragOffsetY : 0;
              
              // Opacity: 100% for current, 0 for others unless dragging
              const opacity = isCurrent ? 1 : (shouldShow ? 0.4 : 0);
              const isSelected = isCurrent && selectedConversionPlayIndex === index;

              return (
                <div
                  key={`stack-${index}-${stackIndex}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: `translate(${translateX}, ${translateY}px)`,
                    zIndex: zIndex,
                    opacity: opacity,
                    transformOrigin: 'center center',
                    transition: isCurrent && !isDragging
                      ? 'all 0.3s ease' 
                      : !isCurrent 
                        ? `opacity 0.1s ease` // Fast transition when dragging
                        : 'none',
                    cursor: isCurrent ? (isDragging ? 'grabbing' : 'pointer') : 'default',
                    ...(isCurrent && isAnimating && swipeDirection === 'like' && {
                      animation: 'swipeRight 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                    }),
                    ...(isCurrent && isAnimating && swipeDirection === 'dislike' && {
                      animation: 'swipeLeft 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                    })
                  }}
                >
                  <ConversionPlayCard
                    widget={widget}
                    isSelected={isSelected}
                    onClick={(e) => {
                      // Only handle click if not dragging and it's the current card
                      if (isCurrent && !isDragging && !isAnimating) {
                        e.stopPropagation();
                        // Toggle selection: if already selected, deselect; otherwise select
                        if (selectedConversionPlayIndex === index) {
                          setSelectedConversionPlayIndex(null);
                        } else {
                          setSelectedConversionPlayIndex(index);
                        }
                      }
                    }}
                    dragHandlers={{
                      onMouseDown: isCurrent ? handleDragStart : undefined,
                      onTouchStart: isCurrent ? handleDragStart : undefined
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Navigation Dots - positioned in white container, below the card container */}
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '30px', // Space below the card container (24px + 2px)
            marginBottom: '16px',
            zIndex: 200,
            pointerEvents: 'auto'
          }}>
            {filteredWidgets.map((widget, index) => (
              <button
                key={`dot-${index}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentWidgetIndex(index);
                }}
                type="button"
                style={{
                  width: currentWidgetIndex === index ? '10px' : '8px',
                  height: currentWidgetIndex === index ? '10px' : '8px',
                  borderRadius: '50%',
                  background: currentWidgetIndex === index ? '#3B82F6' : '#9CA3AF',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.3s ease',
                  opacity: 1,
                  position: 'relative',
                  zIndex: 201,
                  pointerEvents: 'auto'
                }}
                aria-label={`Go to widget ${index + 1}`}
              />
            ))}
          </div>

          {/* Select/Next Button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '6px', // Moved down 2px
            paddingTop: '0px',
            paddingBottom: '10px'
          }}>
            <button
              onClick={() => handleSwipe('like')}
              disabled={isAnimating || selectedConversionPlayIndex === null}
              style={{
                background: '#FFFFFF',
                border: '1px solid #2563EB',
                borderRadius: '20px',
                padding: '12px 32px',
                cursor: (isAnimating || selectedConversionPlayIndex === null) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: '500',
                color: '#2563EB',
                transition: 'all 0.2s ease',
                opacity: (isAnimating || selectedConversionPlayIndex === null) ? 0.5 : 1,
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                if (!isAnimating && selectedConversionPlayIndex !== null) {
                  e.currentTarget.style.background = '#2563EB';
                  e.currentTarget.style.color = '#FFFFFF';
                }
              }}
              onMouseLeave={(e) => {
                if (!isAnimating && selectedConversionPlayIndex !== null) {
                  e.currentTarget.style.background = '#FFFFFF';
                  e.currentTarget.style.color = '#2563EB';
                }
              }}
            >
              {selectedConversionPlayIndex !== null ? 'NEXT' : 'SELECT'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

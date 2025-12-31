import React from 'react';
import WidgetLivePreview from "../components/WidgetLivePreview.jsx";

export default function Step3({
  selectedIdea,
  widgetSettings,
  setWidgetSettings,
  activeSettingsTab,
  setActiveSettingsTab,
  isBlockSaved,
  canOpenThemeEditor,
  shop,
  wizardVariantProductHandle,
  wizardVariantName,
  openVariantInThemeEditor,
  setCurrentStep
}) {
  return (
    <div style={{
      animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      transform: 'translateX(0)',
      opacity: 1
    }}>
      <h2 style={{
        fontSize: '32px',
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: '8px',
        textAlign: 'center'
      }}>
        Customize Your Idea
      </h2>
      <p style={{
        fontSize: '16px',
        color: '#6B7280',
        marginBottom: '40px',
        textAlign: 'center'
      }}>
        Make it match your brand perfectly.
      </p>

      {/* Main Container - Two Columns */}
      <div style={{
        display: 'flex',
        gap: '24px',
        alignItems: 'flex-start'
      }}>
        {/* Left Side - Settings with Tabs */}
        <div style={{
          flex: '0 0 400px',
          maxWidth: '400px',
          background: '#FFFFFF',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          height: '800px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            background: '#F3F4F6',
            padding: '4px',
            borderRadius: '8px'
          }}>
            {['Text Content', 'Padding', 'Icons & Effects', 'Border'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSettingsTab(tab)}
                style={{
                  padding: '12px 20px',
                  background: activeSettingsTab === tab ? '#FFFFFF' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: activeSettingsTab === tab ? '#3B82F6' : '#6B7280',
                  fontSize: '14px',
                  fontWeight: activeSettingsTab === tab ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: activeSettingsTab === tab ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {/* Text Content Tab */}
            {activeSettingsTab === 'Text Content' && (
              <>
                {/* Header Text - Only show if headerText is not empty */}
                {widgetSettings.headerText && widgetSettings.headerText.trim() !== '' && (
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Header Text
                    </label>
                    <input
                      type="text"
                      value={widgetSettings.headerText}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, headerText: e.target.value }))}
                      placeholder="Enter header text..."
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: '#FFFFFF'
                      }}
                    />
                  </div>
                )}

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Body Text
                  </label>
                  <textarea
                    value={widgetSettings.bodyText}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, bodyText: e.target.value }))}
                    placeholder="Enter body text..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#FFFFFF',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* Cart Count Range - Only show for How Many in Cart conversion play */}
                {selectedIdea?.utility === 'How Many in Cart' && (
                  <>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '8px'
                      }}>
                        Minimum Visitor Count
                      </label>
                      <input
                        type="number"
                        value={widgetSettings.count_min}
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10);
                          if (!isNaN(value) && value >= 0) {
                            setWidgetSettings(prev => ({ ...prev, count_min: value }));
                          }
                        }}
                        placeholder="40"
                        min="0"
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '1px solid #D1D5DB',
                          borderRadius: '8px',
                          fontSize: '14px',
                          background: '#FFFFFF'
                        }}
                      />
                      <p style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        margin: '4px 0 0 0'
                      }}>
                        The minimum number for the visitor count fluctuation
                      </p>
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '8px'
                      }}>
                        Maximum Visitor Count
                      </label>
                      <input
                        type="number"
                        value={widgetSettings.count_max}
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10);
                          if (!isNaN(value) && value >= 0) {
                            setWidgetSettings(prev => ({ ...prev, count_max: value }));
                          }
                        }}
                        placeholder="60"
                        min="0"
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '1px solid #D1D5DB',
                          borderRadius: '8px',
                          fontSize: '14px',
                          background: '#FFFFFF'
                        }}
                      />
                      <p style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        margin: '4px 0 0 0'
                      }}>
                        The maximum number for the visitor count fluctuation
                      </p>
                    </div>
                  </>
                )}

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Text Color
                  </label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={widgetSettings.textColor}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, textColor: e.target.value }))}
                      style={{
                        width: '60px',
                        height: '40px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    />
                    <input
                      type="text"
                      value={widgetSettings.textColor}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, textColor: e.target.value }))}
                      placeholder="#000000"
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: '#FFFFFF'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Background Color
                  </label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={widgetSettings.backgroundColor}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, backgroundColor: e.target.value }))}
                      style={{
                        width: '60px',
                        height: '40px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    />
                    <input
                      type="text"
                      value={widgetSettings.backgroundColor}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, backgroundColor: e.target.value }))}
                      placeholder="#f5f5f0"
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: '#FFFFFF'
                      }}
                    />
                  </div>
                </div>

                {/* Header Color */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Header Color
                  </label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={widgetSettings.header_color}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, header_color: e.target.value }))}
                      style={{
                        width: '60px',
                        height: '40px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    />
                    <input
                      type="text"
                      value={widgetSettings.header_color}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, header_color: e.target.value }))}
                      placeholder="#0f172a"
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: '#FFFFFF'
                      }}
                    />
                  </div>
                </div>

                {/* Border Color */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Border Color
                  </label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={widgetSettings.border_color}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, border_color: e.target.value }))}
                      style={{
                        width: '60px',
                        height: '40px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    />
                    <input
                      type="text"
                      value={widgetSettings.border_color}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, border_color: e.target.value }))}
                      placeholder="#d4d4d8"
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: '#FFFFFF'
                      }}
                    />
                  </div>
                </div>

                {/* Header Font */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Header Font
                  </label>
                  <select
                    value={widgetSettings.header_font}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, header_font: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#FFFFFF'
                    }}
                  >
                    <option value="system">System default</option>
                    <option value="poppins">Poppins</option>
                    <option value="inter">Inter</option>
                    <option value="roboto">Roboto</option>
                    <option value="lato">Lato</option>
                    <option value="montserrat">Montserrat</option>
                    <option value="opensans">Open Sans</option>
                    <option value="raleway">Raleway</option>
                    <option value="playfair">Playfair Display</option>
                    <option value="merriweather">Merriweather</option>
                    <option value="sourcesans">Source Sans Pro</option>
                    <option value="nunito">Nunito</option>
                    <option value="worksans">Work Sans</option>
                    <option value="ptsans">PT Sans</option>
                    <option value="oswald">Oswald</option>
                    <option value="notosans">Noto Sans</option>
                    <option value="ubuntu">Ubuntu</option>
                    <option value="georgia">Georgia</option>
                    <option value="times">Times New Roman</option>
                    <option value="arial">Arial</option>
                    <option value="helvetica">Helvetica</option>
                    <option value="courier">Courier New</option>
                    <option value="verdana">Verdana</option>
                    <option value="trebuchet">Trebuchet MS</option>
                  </select>
                </div>

                {/* Header Font Size */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Header Font Size (px): {widgetSettings.header_font_size}
                  </label>
                  <input
                    type="range"
                    min="12"
                    max="64"
                    step="1"
                    value={widgetSettings.header_font_size}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, header_font_size: parseInt(e.target.value) }))}
                    style={{
                      width: '100%',
                      maxWidth: '100%'
                    }}
                  />
                </div>

                {/* Header Underline */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={widgetSettings.header_underline}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, header_underline: e.target.checked }))}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    cursor: 'pointer'
                  }}>
                    Header Underline
                  </label>
                </div>

                {/* Body Font */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Body Font
                  </label>
                  <select
                    value={widgetSettings.body_font}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, body_font: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#FFFFFF'
                    }}
                  >
                    <option value="system">System default</option>
                    <option value="poppins">Poppins</option>
                    <option value="inter">Inter</option>
                    <option value="roboto">Roboto</option>
                    <option value="lato">Lato</option>
                    <option value="montserrat">Montserrat</option>
                    <option value="opensans">Open Sans</option>
                    <option value="raleway">Raleway</option>
                    <option value="playfair">Playfair Display</option>
                    <option value="merriweather">Merriweather</option>
                    <option value="sourcesans">Source Sans Pro</option>
                    <option value="nunito">Nunito</option>
                    <option value="worksans">Work Sans</option>
                    <option value="ptsans">PT Sans</option>
                    <option value="oswald">Oswald</option>
                    <option value="notosans">Noto Sans</option>
                    <option value="ubuntu">Ubuntu</option>
                    <option value="georgia">Georgia</option>
                    <option value="times">Times New Roman</option>
                    <option value="arial">Arial</option>
                    <option value="helvetica">Helvetica</option>
                    <option value="courier">Courier New</option>
                    <option value="verdana">Verdana</option>
                    <option value="trebuchet">Trebuchet MS</option>
                  </select>
                </div>

                {/* Body Font Size */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Body Font Size (px): {widgetSettings.body_font_size}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="36"
                    step="1"
                    value={widgetSettings.body_font_size}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, body_font_size: parseInt(e.target.value) }))}
                    style={{
                      width: '100%',
                      maxWidth: '100%'
                    }}
                  />
                </div>

                {/* Body Underline */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={widgetSettings.body_underline}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, body_underline: e.target.checked }))}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    cursor: 'pointer'
                  }}>
                    Body Underline
                  </label>
                </div>

                {/* Header to Body Spacing */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Header to Body Spacing (px): {widgetSettings.header_body_spacing}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="2"
                    value={widgetSettings.header_body_spacing}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, header_body_spacing: parseInt(e.target.value) }))}
                    style={{
                      width: '100%',
                      maxWidth: '100%'
                    }}
                  />
                </div>

                {/* Icon to Text Spacing */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Icon to Text Spacing (px): {widgetSettings.icon_text_spacing}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="2"
                    value={widgetSettings.icon_text_spacing}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, icon_text_spacing: parseInt(e.target.value) }))}
                    style={{
                      width: '100%',
                      maxWidth: '100%'
                    }}
                  />
                </div>
              </>
            )}

            {/* Padding Tab */}
            {activeSettingsTab === 'Padding' && (
              <>
                {/* Inner Padding Horizontal */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Inner Horizontal Padding (px): {widgetSettings.inner_padding_horizontal}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={widgetSettings.inner_padding_horizontal}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, inner_padding_horizontal: parseInt(e.target.value) }))}
                    style={{
                      width: '100%'
                    }}
                  />
                </div>

                {/* Inner Padding Vertical */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Inner Vertical Padding (px): {widgetSettings.inner_padding_vertical}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={widgetSettings.inner_padding_vertical}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, inner_padding_vertical: parseInt(e.target.value) }))}
                    style={{
                      width: '100%'
                    }}
                  />
                </div>

                {/* Inner Padding Horizontal Mobile */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Inner Horizontal Padding Mobile (px): {widgetSettings.inner_padding_horizontal_mobile}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    step="1"
                    value={widgetSettings.inner_padding_horizontal_mobile}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, inner_padding_horizontal_mobile: parseInt(e.target.value) }))}
                    style={{
                      width: '100%'
                    }}
                  />
                </div>

                {/* Inner Padding Vertical Mobile */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Inner Vertical Padding Mobile (px): {widgetSettings.inner_padding_vertical_mobile}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    step="1"
                    value={widgetSettings.inner_padding_vertical_mobile}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, inner_padding_vertical_mobile: parseInt(e.target.value) }))}
                    style={{
                      width: '100%'
                    }}
                  />
                </div>

                {/* Outer Padding Horizontal */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Outer Horizontal Padding (px): {widgetSettings.outer_padding_horizontal}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={widgetSettings.outer_padding_horizontal}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, outer_padding_horizontal: parseInt(e.target.value) }))}
                    style={{
                      width: '100%'
                    }}
                  />
                </div>

                {/* Outer Padding Vertical */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Outer Vertical Padding (px): {widgetSettings.outer_padding_vertical}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={widgetSettings.outer_padding_vertical}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, outer_padding_vertical: parseInt(e.target.value) }))}
                    style={{
                      width: '100%'
                    }}
                  />
                </div>

                {/* Outer Padding Horizontal Mobile */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Outer Horizontal Padding Mobile (px): {widgetSettings.outer_padding_horizontal_mobile}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={widgetSettings.outer_padding_horizontal_mobile}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, outer_padding_horizontal_mobile: parseInt(e.target.value) }))}
                    style={{
                      width: '100%'
                    }}
                  />
                </div>

                {/* Outer Padding Vertical Mobile */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Outer Vertical Padding Mobile (px): {widgetSettings.outer_padding_vertical_mobile}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={widgetSettings.outer_padding_vertical_mobile}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, outer_padding_vertical_mobile: parseInt(e.target.value) }))}
                    style={{
                      width: '100%',
                      maxWidth: '100%'
                    }}
                  />
                </div>
              </>
            )}

            {/* Icons & Effects Tab */}
            {activeSettingsTab === 'Icons & Effects' && (
              <>
                {/* Icon Choice */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Icon Choice
                  </label>
                  <select
                    value={widgetSettings.icon_choice}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, icon_choice: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#FFFFFF'
                    }}
                  >
                    <option value="none">None (no icon)</option>
                    <option value="star">⭐ Star</option>
                    <option value="trophy">🏆 Trophy</option>
                    <option value="gift">🎁 Gift</option>
                  </select>
                </div>

                {/* Custom Icon URL */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Custom Icon URL (optional)
                  </label>
                  <input
                    type="text"
                    value={widgetSettings.icon_custom}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, icon_custom: e.target.value }))}
                    placeholder="Enter custom icon image URL..."
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#FFFFFF'
                    }}
                  />
                  <p style={{
                    fontSize: '12px',
                    color: '#6B7280',
                    margin: '4px 0 0 0'
                  }}>
                    If provided, this will override the selected icon above
                  </p>
                </div>

                {/* Icon Blink */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={widgetSettings.icon_blink}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, icon_blink: e.target.checked }))}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    cursor: 'pointer'
                  }}>
                    Enable Icon Blink Effect
                  </label>
                </div>

                {/* Icon Blink Intensity */}
                {widgetSettings.icon_blink && (
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Icon Blink Intensity: {widgetSettings.icon_blink_intensity}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={widgetSettings.icon_blink_intensity}
                      onChange={(e) => setWidgetSettings(prev => ({ ...prev, icon_blink_intensity: parseInt(e.target.value) }))}
                      style={{
                        width: '100%'
                      }}
                    />
                  </div>
                )}

                {/* Icon Size */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Icon Size (px): {widgetSettings.icon_size}
                  </label>
                  <input
                    type="range"
                    min="12"
                    max="120"
                    step="2"
                    value={widgetSettings.icon_size}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, icon_size: parseInt(e.target.value) }))}
                    style={{
                      width: '100%'
                    }}
                  />
                </div>

                {/* Icon Size Mobile */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Icon Size Mobile (px): {widgetSettings.icon_size_mobile}
                  </label>
                  <input
                    type="range"
                    min="8"
                    max="100"
                    step="2"
                    value={widgetSettings.icon_size_mobile}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, icon_size_mobile: parseInt(e.target.value) }))}
                    style={{
                      width: '100%',
                      maxWidth: '100%'
                    }}
                  />
                </div>
              </>
            )}

            {/* Border Tab */}
            {activeSettingsTab === 'Border' && (
              <>
                {/* Border Radius */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Border Radius (px): {widgetSettings.border_radius}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="1"
                    value={widgetSettings.border_radius}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, border_radius: parseInt(e.target.value) }))}
                    style={{
                      width: '100%'
                    }}
                  />
                </div>

                {/* Border Thickness */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Border Thickness (px): {widgetSettings.border_thickness}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="12"
                    step="1"
                    value={widgetSettings.border_thickness}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, border_thickness: parseInt(e.target.value) }))}
                    style={{
                      width: '100%'
                    }}
                  />
                </div>

                {/* Hover Effect */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={widgetSettings.hover_effect}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, hover_effect: e.target.checked }))}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    cursor: 'pointer'
                  }}>
                    Enable Hover Lift Effect
                  </label>
                </div>

                {/* Drop Shadow */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Drop Shadow Amount: {widgetSettings.drop_shadow}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={widgetSettings.drop_shadow}
                    onChange={(e) => setWidgetSettings(prev => ({ ...prev, drop_shadow: parseInt(e.target.value) }))}
                    style={{
                      width: '100%',
                      maxWidth: '100%'
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Side - Live Preview */}
        <WidgetLivePreview
          widgetSettings={widgetSettings}
          conversionPlayType={
            selectedIdea?.utility === 'How Many in Cart' 
              ? 'how-many-in-cart' 
              : selectedIdea?.utility === 'Free Shipping Badge' || selectedIdea?.utility === 'Returns Guarantee Badge'
              ? ''
              : ''
          }
          countMin={widgetSettings.count_min || 40}
          countMax={widgetSettings.count_max || 60}
          isBlockSaved={isBlockSaved}
          canOpenThemeEditor={canOpenThemeEditor}
          openVariantInThemeEditor={openVariantInThemeEditor}
          shop={shop}
          wizardVariantProductHandle={wizardVariantProductHandle}
          wizardVariantName={wizardVariantName}
        />
      </div>

      {/* Navigation buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: '60px'
      }}>
        <div style={{
          width: '100%',
          display: 'flex',
          gap: '24px'
        }}>
          {/* Spacer for left column (400px + gap) */}
          <div style={{
            flex: '0 0 400px',
            maxWidth: '400px'
          }}></div>
          {/* Right column - align button to end */}
          <div style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={() => setCurrentStep(4)}
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
              Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

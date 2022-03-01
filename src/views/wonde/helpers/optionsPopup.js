import React, { useState, useEffect } from 'react'
import { Popup, Position, ToolbarItem } from 'devextreme-react/popup'
import { CheckBox } from 'devextreme-react/check-box'

export function OptionsPopup(showPopup) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(showPopup)
  }, [showPopup])

  console.log('popup visability', visible)
  return (
    <Popup
      visible={visible}
      dragEnabled={false}
      closeOnOutsideClick={true}
      showCloseButton={false}
      showTitle={true}
      title="Upload Filter Options"
      container=".dx-viewport"
      width={600}
      height={600}
    >
      <Position at="center" my="center" of={null} />
      <ToolbarItem
        widget="dxButton"
        toolbar="bottom"
        location="before"
        options={{ text: 'Cancel' }}
      />
      <ToolbarItem
        widget="dxButton"
        toolbar="bottom"
        location="after"
        options={{ text: 'Filter' }}
      />
      <p>
        <span>Put the controls here</span>&nbsp;
      </p>
      <div className="dx-field">
        <div className="dx-field-label">Checked</div>
        <div className="dx-field-value">
          <CheckBox defaultValue={true} />
        </div>
      </div>
    </Popup>
  )
}

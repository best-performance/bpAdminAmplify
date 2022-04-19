import React from 'react'
import { Popup } from 'devextreme-react/popup'
import PropTypes from 'prop-types'

// Component designed to show special attributes of the user received in ManageUsers, it works as a popup
function SpecialAttributesPopUp({ setSpecialAttributes, specialAttributes }) {
  function OnSpecialAttributesHidding() {
    setSpecialAttributes(null)
  }
  return (
    <Popup
      visible={specialAttributes ? true : false}
      onHiding={OnSpecialAttributesHidding}
      dragEnabled={false}
      closeOnOutsideClick={true}
      showCloseButton={true}
      showTitle={true}
      title="User's attributes"
      container=".dx-viewport"
      width={500}
      height={130}
    >
      {specialAttributes.map((a, index) => {
        return (
          <div key={index}>
            <p style={{ fontSize: '12pt' }}>
              {a.Name}: <span style={{ fontSize: '12pt' }}>{a.Value}</span>
            </p>
          </div>
        )
      })}
    </Popup>
  )
}
export default SpecialAttributesPopUp

SpecialAttributesPopUp.propTypes = {
  setSpecialAttributes: PropTypes.func.isRequired,
  specialAttributes: PropTypes.array.isRequired,
}

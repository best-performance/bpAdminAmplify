import React, { useState } from 'react'
import { Popup, Position, ToolbarItem } from 'devextreme-react/popup'
import { Button } from 'devextreme-react/button'
import { CContainer, CCol, CRow } from '@coreui/react'
import { CheckBox } from 'devextreme-react/check-box'
import TextBox from 'devextreme-react/text-box'

// eslint-disable-next-line react/prop-types
export function OptionsPopup({
  // eslint-disable-next-line react/prop-types
  parentYearOptions,
  // eslint-disable-next-line react/prop-types
  parentKindyOptions,
  // eslint-disable-next-line react/prop-types
  parentKindyClassName,
  // eslint-disable-next-line react/prop-types
  parentCoreSubjectOption,
  // eslint-disable-next-line react/prop-types
  setOptionsPopupVisible,
  // eslint-disable-next-line react/prop-types
  setParentYearOptions,
  // eslint-disable-next-line react/prop-types
  setParentKinterDayClasses,
  // eslint-disable-next-line react/prop-types
  setParentKinterDayClassName,
}) {
  const [kindyOption, setKindyOption] = useState(parentKindyOptions)
  const [kindyClassname, setKindyClassname] = useState(parentKindyClassName)
  const [bulkSwitch, setBulkSwitch] = useState(false)
  const [coreSubjectOption, setCoreSubjectOption] = useState(parentCoreSubjectOption)
  const [yearOptions, setYearOptions] = useState(parentYearOptions)
  // this is fired if any year level option changes
  function yearOptionChanged(e) {
    console.log(e.component._props.text, e.value)
    let yearOptionsCopy = yearOptions
    switch (e.component._props.text) {
      case 'Year 1':
        yearOptionsCopy.Y1 = e.value
        break
      case 'Year 2':
        yearOptionsCopy.Y2 = e.value
        break
      case 'Year 3':
        yearOptionsCopy.Y3 = e.value
        break
      case 'Year 4':
        yearOptionsCopy.Y4 = e.value
        break
      case 'Year 5':
        yearOptionsCopy.Y5 = e.value
        break
      case 'Year 6':
        yearOptionsCopy.Y6 = e.value
        break
      case 'Year 7':
        yearOptionsCopy.Y7 = e.value
        break
      case 'Year 8':
        yearOptionsCopy.Y8 = e.value
        break
      case 'Year 9':
        yearOptionsCopy.Y9 = e.value
        break
      case 'Year 10':
        yearOptionsCopy.Y10 = e.value
        break
      case 'Year 11':
        yearOptionsCopy.Y11 = e.value
        break
      case 'Year 12':
        yearOptionsCopy.Y12 = e.value
        break
      case 'Kindy':
        yearOptionsCopy.K = e.value
        break
      case 'Reception/Fy':
        yearOptionsCopy.R = e.value
        break
      default:
        break
    }
    setYearOptions(yearOptionsCopy)
  }

  // this is fired when the opption to remove Kindy duplicates changes
  function kindyOptionChanged(e) {
    setKindyOption(e.value)
    console.log(e.value)
  }
  // this is fired when the kindy class name is changed
  function kindyNameChange(e) {
    if (e.value.length >= 1) setKindyClassname(e.value)
    console.log()
  }

  // this is fired when the opption to remove Kindy duplicates changes
  function coreSubjectOptionChanged(e) {
    setCoreSubjectOption(e.value)
    console.log(e.value)
  }
  // this is fired when done and we want to apply the filters
  function applyFilters() {
    console.log('apply filters')
    setParentYearOptions(yearOptions)
    setParentKinterDayClassName(kindyClassname)
    setParentKinterDayClasses(kindyOption)
    setOptionsPopupVisible(false)
  }

  // this is fired when done and we want to apply the filters
  function cancel() {
    console.log('cancel')
    setOptionsPopupVisible(false)
  }

  // this is fired when selectAll or deselectall is presses
  function selectAll(e) {
    return // causes recursive update and crashes
    let tickboxVal
    if (e.component._props.text === 'Select All') {
      tickboxVal = true
      console.log('selectAll')
    } else {
      tickboxVal = false
      console.log('deselectAll')
    }
    setYearOptions({
      Y1: tickboxVal,
      Y2: tickboxVal,
      Y3: tickboxVal,
      Y4: tickboxVal,
      Y5: tickboxVal,
      Y6: tickboxVal,
      Y7: tickboxVal,
      Y8: tickboxVal,
      Y9: tickboxVal,
      Y10: tickboxVal,
      Y11: tickboxVal,
      Y12: tickboxVal,
      K: tickboxVal,
      R: tickboxVal,
    })
  }

  return (
    <Popup
      visible={true}
      dragEnabled={false}
      closeOnOutsideClick={true}
      showCloseButton={false}
      showTitle={true}
      title="Upload Filter Options"
      container=".dx-viewport"
      width={500}
      height={500}
    >
      <Position at="center" my="center" of={null} />
      <ToolbarItem
        widget="dxButton"
        toolbar="bottom"
        location="before"
        options={{ text: 'Accept', onClick: applyFilters }}
      />
      <ToolbarItem
        widget="dxButton"
        toolbar="bottom"
        location="after"
        options={{ text: 'Cancel', onClick: cancel }}
      />
      <CContainer>
        <CRow>
          <CCol sm={4}>
            <div style={{ height: '30px', fontWeight: 'bold' }}>Select Year Levels</div>
          </CCol>
          <CCol sm={8}>
            <div style={{ height: '30px', fontWeight: 'bold' }}>Other Options</div>
          </CCol>
        </CRow>
        <CRow>
          <CCol sm={4}>
            <div>
              <CheckBox
                defaultValue={yearOptions.Y1}
                text="Year 1"
                onValueChanged={yearOptionChanged}
              />
            </div>
            <div>
              <CheckBox
                defaultValue={yearOptions.Y2}
                text="Year 2"
                onValueChanged={yearOptionChanged}
              />
            </div>
            <div>
              <CheckBox
                defaultValue={yearOptions.Y3}
                text="Year 3"
                onValueChanged={yearOptionChanged}
              />
            </div>
            <div>
              <CheckBox
                defaultValue={yearOptions.Y4}
                text="Year 4"
                onValueChanged={yearOptionChanged}
              />
            </div>
            <div>
              <CheckBox
                defaultValue={yearOptions.Y5}
                text="Year 5"
                onValueChanged={yearOptionChanged}
              />
            </div>
            <div>
              <CheckBox
                defaultValue={yearOptions.Y6}
                text="Year 6"
                onValueChanged={yearOptionChanged}
              />
            </div>
            <div>
              <CheckBox
                defaultValue={yearOptions.Y7}
                text="Year 7"
                onValueChanged={yearOptionChanged}
              />
            </div>
            <div>
              <CheckBox
                defaultValue={yearOptions.Y8}
                text="Year 8"
                onValueChanged={yearOptionChanged}
              />
            </div>
            <div>
              <CheckBox
                defaultValue={yearOptions.Y9}
                text="Year 9"
                onValueChanged={yearOptionChanged}
              />
            </div>
            <div>
              <CheckBox
                defaultValue={yearOptions.Y10}
                text="Year 10"
                onValueChanged={yearOptionChanged}
              />
            </div>
            <div>
              <CheckBox
                defaultValue={yearOptions.Y11}
                text="Year 11"
                onValueChanged={yearOptionChanged}
              />
            </div>
            <div>
              <CheckBox
                defaultValue={yearOptions.Y12}
                text="Year 12"
                onValueChanged={yearOptionChanged}
              />
            </div>
            <div>
              <CheckBox
                defaultValue={yearOptions.K}
                text="Kindy"
                onValueChanged={yearOptionChanged}
              />
            </div>
            <div>
              <CheckBox
                defaultValue={yearOptions.R}
                text="Reception/FY"
                onValueChanged={yearOptionChanged}
              />
            </div>
            <div style={{ height: '20px' }}></div>
            <div>
              <CheckBox defaultValue={false} text="Select All" onValueChanged={selectAll} />
            </div>
            <div>
              <CheckBox defaultValue={false} text="Deselect All" onValueChanged={selectAll} />
            </div>
          </CCol>
          <CCol sm={8}>
            <div>
              <CheckBox
                defaultValue={kindyOption}
                text="Remove Duplicate Kindy Classes"
                onValueChanged={kindyOptionChanged}
              />
            </div>
            <div style={{ height: '15px' }}></div>
            <div style={{ width: '60%' }}>
              <TextBox
                defaultValue={kindyClassname}
                onValueChanged={kindyNameChange}
                label="Kindy classname to use"
                height="50px"
                hint="edit to change the name of kindy classroom"
              />
            </div>
            <div style={{ height: '15px' }}></div>
            <div>
              <CheckBox
                defaultValue={coreSubjectOption}
                text="Core subject classrooms only"
                onValueChanged={coreSubjectOptionChanged}
              />
            </div>
          </CCol>
        </CRow>
      </CContainer>
    </Popup>
  )
}

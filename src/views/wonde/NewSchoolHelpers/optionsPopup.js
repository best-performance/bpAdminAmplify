/**
 * This popop allows the use to select options for uploading Wonde data to
 * DynamoDB
 */
/* eslint-disable react/prop-types */
import React, { useEffect, useState } from 'react'
import { Popup, Position, ToolbarItem } from 'devextreme-react/popup'
import { Button } from 'devextreme-react/button'
import { CContainer, CCol, CRow } from '@coreui/react'
import { CheckBox } from 'devextreme-react/check-box'
import TextBox from 'devextreme-react/text-box'
import { v4 } from 'uuid'

export function OptionsPopup({
  // option values passed in by parent
  // Explanations in applyFilters() below
  yearLevelStatusArray, // array of objects like {yearLevel: Y1, isLoaded:true}
  parentYearOptions, // an array of objects like {Y1: true}
  parentKindyOptions,
  parentKindyClassName,
  parentCoreSubjectOption,
  parentSaveToCognitoOption,
  parentMergePrimaryClassesOption,
  // Parents set functions for its state variables
  setParentYearOptions,
  setParentKinterDayClasses,
  setParentKinterDayClassName,
  setParentCoreSubjectOption,
  setParentSaveToCognitoOption,
  setParentMergePrimaryClassesOption,
  setOptionsPopupVisible,
  setParentDataFilterPending,
}) {
  const [kindyOption, setKindyOption] = useState(parentKindyOptions)
  const [kindyClassname, setKindyClassname] = useState(parentKindyClassName)
  const [coreSubjectOption, setCoreSubjectOption] = useState(parentCoreSubjectOption)
  const [mergePrimaryClassesOption, setMergePrimaryClassesOption] = useState(
    parentMergePrimaryClassesOption,
  )
  const [yearOptions, setYearOptions] = useState(parentYearOptions)
  const [saveToCognitoOption, setSaveToCognitoOption] = useState(parentSaveToCognitoOption)
  const [selectAllToggle, setSelectAllToggle] = useState(true)

  // useEffect() Just for debugging - can be commented out
  useEffect(() => {
    console.log('rendered', yearOptions)
  }, [yearOptions])

  // Fired when done and we want to pass the changes back to <NewSchool>
  // set the state variables in <NewSchool> and closes the popup
  function applyFilters() {
    console.log('apply filters')
    setParentYearOptions(yearOptions) // which years levels you want to upload
    setParentKinterDayClassName(kindyClassname) // set the name you want for merged kindy classes
    setParentKinterDayClasses(kindyOption) // set if you want to merge kindy classes
    setParentCoreSubjectOption(coreSubjectOption) // set if you only want core subject classes
    setParentSaveToCognitoOption(saveToCognitoOption) // set of you want to save students to Cognito
    setParentMergePrimaryClassesOption(mergePrimaryClassesOption) // set of you want to merge primary classes with same teacher
    setParentDataFilterPending(true)
    setOptionsPopupVisible(false)
  }

  // Fired if any year level option changes
  function yearOptionChanged(e) {
    if (e.event) {
      console.log('event', e)
      console.log(e.component._props.text, e.value)
      let yearOptionsCopy = { ...yearOptions }
      // The "in" operator below check if the object key exists
      if (e.component._props.text in yearOptionsCopy) {
        yearOptionsCopy[e.component._props.text] = e.value
        setYearOptions(yearOptionsCopy)
      }
    }
  }

  // Fired when the option to remove Kindy duplicates changes
  function kindyOptionChanged(e) {
    setKindyOption(e.value)
    console.log(e.value)
  }
  // Fired when the kindy class name is changed
  function kindyNameChange(e) {
    if (e.value.length >= 1) setKindyClassname(e.value)
    console.log()
  }

  // Fired when the opption to remove Kindy duplicates changes
  function saveToCognitoOptionChanged(e) {
    setSaveToCognitoOption(e.value)
    console.log(e.value)
  }

  // Fired when the option to save students to Congito changes
  function coreSubjectOptionChanged(e) {
    setCoreSubjectOption(e.value)
    console.log(e.value)
  }

  function mergePrimaryClassesOptionChanged(e) {
    setMergePrimaryClassesOption(e.value)
    console.log(e.value)
  }

  // this is fired when done and cancelling with no changes
  function cancel() {
    console.log('cancel')
    setOptionsPopupVisible(false)
  }

  // this is fired when selectAll or deselectAll is pressed
  function selectAll(e) {
    let tickboxVal
    if (selectAllToggle) {
      tickboxVal = true
      console.log('selectAll')
      setSelectAllToggle(false)
    } else {
      tickboxVal = false
      console.log('deselectAll')
      setSelectAllToggle(true)
    }

    let yearOptionsNew = { ...yearOptions }
    yearLevelStatusArray.forEach((item) => {
      if (item.yearLevel in yearOptionsNew) {
        yearOptionsNew[item.yearLevel] = tickboxVal
      }
    })

    setYearOptions(yearOptionsNew)
  }

  // This function reads the input parameters and displays
  // the available year levels, the loaded status and the option status
  function displayAvailableYearLevels() {
    console.log('yearLevelStatusArray', yearLevelStatusArray)
    console.log('yearOptions', yearOptions)
    let retVal = yearLevelStatusArray.map((item) => {
      return (
        <div key={v4()}>
          <span style={{ display: 'inline-block', width: '80px' }}>
            <CheckBox
              value={yearOptions[item.yearLevel]}
              text={item.yearLevel}
              onValueChanged={yearOptionChanged}
              //readOnly={item.isLoaded}
            />
          </span>
          <span>
            <CheckBox value={item.isLoaded} readOnly={true} />
          </span>
        </div>
      )
    })
    return retVal
  }

  return (
    <Popup
      visible={true}
      dragEnabled={false}
      closeOnOutsideClick={true}
      showCloseButton={false}
      showTitle={true}
      title="Filter Options"
      container=".dx-viewport"
      width={550}
      height={320 + yearLevelStatusArray.length * 15}
    >
      <Position at="center" my="center" of={null} />

      <ToolbarItem
        widget="dxButton"
        toolbar="bottom"
        location="before"
        options={{ text: 'Apply', onClick: applyFilters }}
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
            <div style={{ height: '30px', fontWeight: 'bold' }}>
              <span style={{ display: 'inline-block', width: '70px' }}>Years</span>
              <span>Loaded</span>
            </div>
          </CCol>
          <CCol sm={8}>
            <div style={{ height: '30px', fontWeight: 'bold', textAlign: 'center' }}>
              Other Options
            </div>
          </CCol>
        </CRow>
        <CRow>
          <CCol sm={5}>
            {displayAvailableYearLevels()}
            <div style={{ height: '40px' }}>
              <Button height="35px" style={{ marginTop: '15px' }} onClick={selectAll}>
                {selectAllToggle ? 'Select All' : 'Deselect All'}
              </Button>
            </div>
          </CCol>
          <CCol sm={7}>
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
                hint="Edit to change the name of kindy classroom"
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
            <div style={{ height: '15px' }}></div>
            <div>
              <CheckBox
                defaultValue={mergePrimaryClassesOption}
                text="Merge primary classes with same teacher"
                onValueChanged={mergePrimaryClassesOptionChanged}
              />
            </div>
            <div style={{ height: '15px' }}></div>
            <div>
              <CheckBox
                defaultValue={saveToCognitoOption}
                text="Save Students to Cognito"
                onValueChanged={saveToCognitoOptionChanged}
              />
            </div>
          </CCol>
        </CRow>
      </CContainer>
    </Popup>
  )
}

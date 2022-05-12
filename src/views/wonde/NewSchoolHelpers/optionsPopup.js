/* eslint-disable react/prop-types */
import React, { useEffect, useState } from 'react'
import { Popup, Position, ToolbarItem } from 'devextreme-react/popup'
import { Button } from 'devextreme-react/button'
import { CContainer, CCol, CRow } from '@coreui/react'
import { CheckBox } from 'devextreme-react/check-box'
import TextBox from 'devextreme-react/text-box'
import { isAUSRegion } from '../CommonHelpers/featureToggles'

export function OptionsPopup({
  yearStatusArray, // array of objects like {Y1: {isInSchool: true, IsLoaded :false}}
  parentYearOptions, // an array of objects like {Y1: true}
  parentKindyOptions,
  parentKindyClassName,
  parentCoreSubjectOption,
  setOptionsPopupVisible,
  setParentYearOptions,
  setParentKinterDayClasses,
  setParentKinterDayClassName,
  setParentCoreSubjectOption,
  setParentDataFilterPending,
}) {
  const [kindyOption, setKindyOption] = useState(parentKindyOptions)
  const [kindyClassname, setKindyClassname] = useState(parentKindyClassName)
  const [coreSubjectOption, setCoreSubjectOption] = useState(parentCoreSubjectOption)
  const [yearOptions, setYearOptions] = useState(parentYearOptions)
  const [selectAllToggle, setSelectAllToggle] = useState(false)

  useEffect(() => {
    console.log('rendered', yearOptions)
  }, [yearOptions])

  // this is fired if any year level option changes
  function yearOptionChanged(e) {
    if (e.event) {
      console.log('event', e)
      console.log(e.component._props.text, e.value)
      let yearOptionsCopy = { ...yearOptions }
      if (e.component._props.text in yearOptionsCopy)
        yearOptionsCopy[e.component._props.text] = e.value
      //   switch (e.component._props.text) {
      //     case 'Y1':
      //       yearOptionsCopy.Y1 = e.value
      //       break
      //     case 'Y2':
      //       yearOptionsCopy.Y2 = e.value
      //       break
      //     case 'Y3':
      //       yearOptionsCopy.Y3 = e.value
      //       break
      //     case 'Y4':
      //       yearOptionsCopy.Y4 = e.value
      //       break
      //     case 'Y5':
      //       yearOptionsCopy.Y5 = e.value
      //       break
      //     case 'Y6':
      //       yearOptionsCopy.Y6 = e.value
      //       break
      //     case 'Y7':
      //       yearOptionsCopy.Y7 = e.value
      //       break
      //     case 'Y8':
      //       yearOptionsCopy.Y8 = e.value
      //       break
      //     case 'Y9':
      //       yearOptionsCopy.Y9 = e.value
      //       break
      //     case 'Y10':
      //       yearOptionsCopy.Y10 = e.value
      //       break
      //     case 'Y11':
      //       yearOptionsCopy.Y11 = e.value
      //       break
      //     case 'Y12':
      //       yearOptionsCopy.Y12 = e.value
      //       break
      //     case 'Y13':
      //       yearOptionsCopy.Y13 = e.value
      //       break
      //     case 'K':
      //       yearOptionsCopy.K = e.value
      //       break
      //     case 'FY':
      //       yearOptionsCopy.FY = e.value
      //       break
      //     case 'R':
      //       yearOptionsCopy.R = e.value
      //       break
      //     default:
      //       break
      //   }
      setYearOptions(yearOptionsCopy)
    }
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
  // this is fired when done and we want to pass teh changes back to <NewSchool>
  function applyFilters() {
    console.log('apply filters')
    setParentYearOptions(yearOptions)
    setParentKinterDayClassName(kindyClassname)
    setParentKinterDayClasses(kindyOption)
    setParentCoreSubjectOption(coreSubjectOption)
    setParentDataFilterPending(true)
    setOptionsPopupVisible(false)
  }

  // this is fired when done and cancelling with no changes
  function cancel() {
    console.log('cancel')
    setOptionsPopupVisible(false)
  }

  // this is fired when selectAll or deselectall is presses
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
    let yearOptionsCopy = {}
    yearOptionsCopy.Y1 = tickboxVal
    yearOptionsCopy.Y2 = tickboxVal
    yearOptionsCopy.Y3 = tickboxVal
    yearOptionsCopy.Y4 = tickboxVal
    yearOptionsCopy.Y5 = tickboxVal
    yearOptionsCopy.Y6 = tickboxVal
    yearOptionsCopy.Y7 = tickboxVal
    yearOptionsCopy.Y8 = tickboxVal
    yearOptionsCopy.Y9 = tickboxVal
    yearOptionsCopy.Y10 = tickboxVal
    yearOptionsCopy.Y11 = tickboxVal
    yearOptionsCopy.Y12 = tickboxVal
    yearOptionsCopy.Y13 = tickboxVal
    yearOptionsCopy.K = tickboxVal
    yearOptionsCopy.FY = tickboxVal
    yearOptionsCopy.R = tickboxVal

    setYearOptions(yearOptionsCopy)
  }

  const yearStatusArrayTmp = [
    { yearLevel: 'K', isInSchool: true, isLoaded: false },
    { yearLevel: 'FY', isInSchool: true, isLoaded: false },
    { yearLevel: 'R', isInSchool: true, isLoaded: false },
    { yearLevel: 'Y1', isInSchool: true, isLoaded: false },
    { yearLevel: 'Y2', isInSchool: true, isLoaded: true },
    { yearLevel: 'Y3', isInSchool: true, isLoaded: false },
    { yearLevel: 'Y4', isInSchool: true, isLoaded: true },
    { yearLevel: 'Y5', isInSchool: true, isLoaded: false },
    { yearLevel: 'Y6', isInSchool: true, isLoaded: false },
    { yearLevel: 'Y7', isInSchool: false, isLoaded: false },
    { yearLevel: 'Y8', isInSchool: false, isLoaded: false },
    { yearLevel: 'Y9', isInSchool: false, isLoaded: false },
    { yearLevel: 'Y10', isInSchool: false, isLoaded: false },
    { yearLevel: 'Y11', isInSchool: false, isLoaded: false },
    { yearLevel: 'Y12', isInSchool: false, isLoaded: false },
    { yearLevel: 'Y13', isInSchool: false, isLoaded: false },
  ]

  // This function reads the input parameters and displays
  // the available year levels, the loaded status and the option status
  function displayAvailableYearLevels() {
    let retVal = yearStatusArrayTmp.map((item) => {
      if (item.isInSchool) {
        return (
          <div>
            <span style={{ display: 'inline-block', width: '80px' }}>
              <CheckBox
                value={yearOptions[item.yearLevel]}
                text={item.yearLevel}
                onValueChanged={yearOptionChanged}
              />
            </span>
            <span>
              <CheckBox value={item.isLoaded} />
            </span>
          </div>
        )
      } else {
        return <></>
      }
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
      height={600}
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

import React, { useEffect, useState, useCallback, useContext } from 'react'
import loggedInContext from 'src/loggedInContext'
import { CContainer, CCol, CRow, CSpinner } from '@coreui/react'
import Button from 'devextreme-react/button'
import { DataGrid, Selection, SearchPanel, Column, Export } from 'devextreme-react/data-grid'
import TabPanel, { Item } from 'devextreme-react/tab-panel'
//import _ from 'lodash'
import { Auth } from 'aws-amplify'
import AWS from 'aws-sdk'
// Helper functions
import { getUploadedSchools } from './UpdateSchoolHelpers/getUploadedSchools'
import { getRegion } from './CommonHelpers/featureToggles'
import getChangedStudents from './UpdateSchoolHelpers/getChangedStudents'
import processStudent from './UpdateSchoolHelpers/processStudent'

// Note: We use env-cmd to read .env.local which contains environment variables copied from Amplify
// In production, the environment variables will be loaded automatically by the build script in amplify.yml
// For local starts, the amplify.yml script is not activated, so instead we use "> npm run start:local"
// This first runs the env-cmd that loads the environment variables prior to the main start script

//Lookup tables
const COUNTRY_TABLE = process.env.REACT_APP_COUNTRY_TABLE
const YEARLEVEL_TABLE = process.env.REACT_APP_YEARLEVEL_TABLE
const STATE_TABLE = process.env.REACT_APP_STATE_TABLE
//const LEARNINGAREA_TABLE = process.env.REACT_APP_LEARNINGAREA_TABLE

// Tables to store school data
// We need to generalise this for regional table names
// Maybe use a dynamo query to list the available table names?
const SCHOOL_TABLE = process.env.REACT_APP_SCHOOL_TABLE
const STUDENT_TABLE = process.env.REACT_APP_STUDENT_TABLE
const USER_TABLE = process.env.REACT_APP_USER_TABLE
const SCHOOL_STUDENT_TABLE = process.env.REACT_APP_SCHOOL_STUDENT_TABLE
const CLASSROOM_TABLE = process.env.REACT_APP_CLASSROOM_TABLE
const CLASSROOM_TEACHER_TABLE = process.env.REACT_APP_CLASSROOM_TEACHER_TABLE
const CLASSROOM_STUDENT_TABLE = process.env.REACT_APP_CLASSROOM_STUDENT_TABLE
const CLASSROOM_YEARLEVEL_TABLE = process.env.REACT_APP_CLASSROOM_YEARLEVEL_TABLE
//const CLASSROOM_LEARNINGAREA_TABLE = process.env.REACT_APP_CLASSROOM_LEARNINGAREA_TABLE
//const STUDENT_DATA_TABLE = process.env.REACT_APP_STUDENT_DATA_TABLE

// Not environment varible as this is not region-dependent
const SCHOOL_WONDE_INDEX = 'byWondeID'

// Constant used to create the teacher and student entries in cognito
const USER_POOL_ID = process.env.REACT_APP_EDCOMPANION_USER_POOL_ID

// a fixed afterDate for test purposes
//TODO: calculate this date from last update
const afterDate = '2022-03-16 00:00:00' // formatted as per Wonde examples

// React component for user to list Wonde schools, read a school and upload the data to EdCompanion
function UpdateSchool() {
  const { loggedIn } = useContext(loggedInContext)
  // school list and slected school
  const [selectedSchool, setSelectedSchool] = useState({ schoolName: 'none' })
  const [schools, setSchools] = useState([])

  // To display the changed students (new students or details changed)
  const [changedStudents, setChangedStudents] = useState([])

  // This one is for the CSV upload display (as per the standard upload spreadsheet)
  const [studentClassrooms, setStudentClassrooms] = useState([])
  const [filteredStudentClassrooms, setFilteredStudentClassrooms] = useState([]) // after filters are applied

  // some loading indicators
  const [isLoadingSchools, setIsLoadingSchools] = useState(false)
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false)
  const [schoolDataLoaded, setSchoolDataLoaded] = useState(false)

  // lookup Tables - these are used by the uploader
  // to locate respective item ids
  const [countriesLookup, setCountriesLookup] = useState([])
  const [yearLevelsLookup, setYearLevelsLoookup] = useState([])
  const [statesLookup, setStatesLookup] = useState([])
  // const [learningAreasLookup, setLearningAreasLookup] = useState([])

  // This useEffect() reads and saves the contents of 4 lookups
  // It needs to run just once
  useEffect(() => {
    // we assume for now that the lookups are already populated in sandbox account

    const getLookupData = async () => {
      let credentials
      try {
        credentials = await Auth.currentCredentials()
      } catch (err) {
        console.log(err)
        return
      }

      AWS.config.update({
        credentials: credentials,
        region: getRegion(),
      })
      const docClient = new AWS.DynamoDB.DocumentClient()
      let response
      response = await docClient.scan({ TableName: COUNTRY_TABLE }).promise()
      setCountriesLookup(response.Items)
      response = await docClient.scan({ TableName: YEARLEVEL_TABLE }).promise()
      setYearLevelsLoookup(response.Items)
      response = await docClient.scan({ TableName: STATE_TABLE }).promise()
      setStatesLookup(response.Items)
      // response = await docClient.scan({ TableName: LEARNINGAREA_TABLE }).promise()
      // setLearningAreasLookup(response.Items)
    }
    getLookupData()
    console.log('Loaded lookup tables from dynamoDB in UseEffect()')
  }, [])

  // TEST FUNCTION FOR experimentation TO BE REMOVED LATER
  // There is  UI button that will run the function
  // Any sort of test function here is acceptable
  async function testFunction() {
    console.log('testFuntion() invoked')
    console.log('yearLevels', yearLevelsLookup)
    console.log('countries', countriesLookup)
    console.log('states', statesLookup)
    console.log('environment variables available')
    console.log(`REGION ${process.env.REACT_APP_REGION}`) //
    console.log(`USER_POOL_ID ${USER_POOL_ID}`) //
    console.log(`USER_POOL_CLIENT_ID ${process.env.REACT_APP_USER_POOL_CLIENT_ID}`) //
    // console.log(`ENDPOINT ${process.env.REACT_APP_ENDPOINT}`) //
    console.log(`IDENTITY_POOL(_ID) ${process.env.REACT_APP_IDENTITY_POOL}`)
  } // end of testFuntion()

  // Invokes function to get the list of available schools from Wonde
  // first clears all state
  async function getAllSchools() {
    setIsLoadingSchools(true)
    setSchools([])
    setSelectedSchool({ schoolName: 'none' })
    setSchoolDataLoaded(false)

    // locate all the Wonde schools in EdC
    let schools = await getUploadedSchools()
    if (schools) {
      setSchools(schools)
      setIsLoadingSchools(false)
    } else {
      console.log('Could not read schools from DynamoDB')
    }
  }

  // this is executed if we select a school from the list of schools
  const selectSchool = useCallback((e) => {
    e.component.byKey(e.currentSelectedRowKeys[0]).done((school) => {
      setSelectedSchool(school)
      console.log(school)
    })
    setSchoolDataLoaded(false)
  }, [])

  // Triggered by "Get Wonde updates for ..." button to read all school data
  async function getSchoolUpdates() {
    if (selectedSchool === {}) return

    // find the changed students as per Wonde
    let updatedStudents = await getChangedStudents(selectedSchool, afterDate)
    //console.log(updatedStudents) // as reported by Wonde

    // check each student to see what exactly has changed ( ie details, year,classrooms etc)
    let changedStudents = []
    let promises = updatedStudents.map(async (student) => {
      let changedStudent = await processStudent(student)
      if (changedStudent.length > 0) {
        changedStudent.forEach((row) => {
          changedStudents.push(row)
        })
      }
    })
    await Promise.all(promises)
    console.log('changedStudents', changedStudents)
    setChangedStudents(changedStudents)

    setSchoolDataLoaded(true)
  }

  // dummy callback to be filled in
  function dummyCallback() {
    return
  }

  if (!loggedIn.username) {
    return (
      <CContainer>
        <CRow>Please login first</CRow>
      </CContainer>
    )
  }
  return (
    <CContainer>
      <CRow>
        <div style={{ textAlign: 'center', fontSize: '30px' }}>
          <span>Wonde -</span> <span style={{ color: 'red' }}>Update Existing School</span>
        </div>
      </CRow>
      <div className="d-flex justify-content-center">
        <Button stylingMode="outlined" style={{ marginBottom: '10px' }} onClick={getAllSchools}>
          Get Wonde Schools in EdC/Elastic
        </Button>
        <Button style={{ marginBottom: '10px' }} stylingMode="outlined" onClick={testFunction}>
          run testFunction()
        </Button>
      </div>
      <CRow>
        <CCol></CCol>
        <CCol>
          <div style={{ marginBottom: '10px' }}>
            {isLoadingSchools ? (
              <CSpinner />
            ) : (
              <DataGrid
                id="dataGrid"
                keyExpr="wondeID"
                showBorders={true}
                hoverStateEnabled={true}
                onSelectionChanged={selectSchool}
                allowColumnReordering={true}
                columnAutoWidth={true}
                dataSource={schools}
              >
                <Selection mode="single" />
              </DataGrid>
            )}
          </div>
        </CCol>

        <CCol></CCol>
      </CRow>
      <CRow className="align-items-center">
        <CCol xs={5}>
          <div style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '15px' }}>
            <span>Selected School: </span>{' '}
            <span style={{ color: 'red' }}>{selectedSchool.schoolName}</span>
          </div>
        </CCol>
        <CCol xs={2}>
          {selectedSchool.schoolName !== 'none' ? (
            <Button
              stylingMode="outlined"
              style={{ marginBottom: '15px' }}
              onClick={getSchoolUpdates}
            >
              Get Updates
            </Button>
          ) : null}
        </CCol>
        <CCol xs={1}></CCol>
        <CCol xs={1}></CCol>
        <CCol xs={3}></CCol>
      </CRow>

      <div className="d-flex justify-content-center">
        {schoolDataLoaded ? (
          <>
            <Button stylingMode="outlined" onClick={dummyCallback}>
              {`Save data for ${selectedSchool.schoolName} to EdCompanion`}
            </Button>
          </>
        ) : null}
      </div>

      <CRow>
        <TabPanel>
          <Item title="student updates">
            <CContainer>
              <CRow>
                {isLoadingStudents ? (
                  <CSpinner />
                ) : (
                  <DataGrid
                    id="dataGrid"
                    //keyExpr="wondeStudentId"
                    showBorders={true}
                    hoverStateEnabled={true}
                    allowColumnReordering={true}
                    columnAutoWidth={true}
                    dataSource={changedStudents}
                  >
                    <SearchPanel visible={true} />
                    <Export enabled={true} allowExportSelectedData={true} />
                    <Column caption="FIRST NAME" dataField="firstName" />
                    <Column caption="LAST NAME" dataField="lastName" />
                    <Column caption="GENDER" dataField="gender" />
                    <Column caption="DOB" dataField="dob" />
                    <Column caption="CHANGE" dataField="change" />
                    <Column caption="SOURCE" dataField="source" />
                  </DataGrid>
                )}
              </CRow>
            </CContainer>
          </Item>
          <Item title="teacher updates">
            <CContainer>
              <CRow>
                {isLoadingStudents ? (
                  <CSpinner />
                ) : (
                  <DataGrid
                    id="dataGrid"
                    //keyExpr="wondeStudentId"
                    showBorders={true}
                    hoverStateEnabled={true}
                    allowColumnReordering={true}
                    columnAutoWidth={true}
                    dataSource={filteredStudentClassrooms}
                  >
                    <SearchPanel visible={true} />
                    <Export enabled={true} allowExportSelectedData={true} />
                    <Column caption="First Name" dataField="firstName" />
                    <Column caption="Middle Name" dataField="middleName" />
                    <Column caption="Last Name" dataField="lastName" />
                    <Column caption="Year Code" dataField="yearCode" />
                    <Column caption="Gender" dataField="gender" />
                    <Column caption="DOB" dataField="dob" />
                    <Column caption="Classroom Name" dataField="classroomName" />
                    <Column caption="Subject" dataField="subject" />
                    <Column caption="Teacher 1 First Name" dataField="teacher1 FirstName" />
                    <Column caption="Teacher 1 Last Name" dataField="teacher1 LastName" />
                    <Column caption="Teacher 1 Email" dataField="teacher1 email" />
                    <Column caption="Teacher 2 First Name" dataField="teacher2 FirstName" />
                    <Column caption="Teacher 2 Last Name" dataField="teacher2 LastName" />
                    <Column caption="Teacher 2 Email" dataField="teacher2 email" />
                    <Column caption="Teacher 3 First Name" dataField="teacher3 FirstName" />
                    <Column caption="Teacher 3 Last Name" dataField="teacher3 LastName" />
                    <Column caption="Teacher 3 Email" dataField="teacher3 email" />
                    <Column caption="Teacher 4 First Name" dataField="teacher4 FirstName" />
                    <Column caption="Teacher 4 Last Name" dataField="teacher4 LastName" />
                    <Column caption="Teacher 4 Email" dataField="teacher4 email" />
                    <Column caption="Teacher 5 First Name" dataField="teacher5 FirstName" />
                    <Column caption="Teacher 5 Last Name" dataField="teacher5 LastName" />
                    <Column caption="Teacher 5 Email" dataField="teacher5 email" />
                  </DataGrid>
                )}
              </CRow>
            </CContainer>
          </Item>
        </TabPanel>
      </CRow>
    </CContainer>
  )
}
export default UpdateSchool

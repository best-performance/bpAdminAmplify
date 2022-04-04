import React, { useState, useCallback, useContext } from 'react'
import loggedInContext from 'src/loggedInContext'
import { CContainer, CCol, CRow, CSpinner } from '@coreui/react'
import Button from 'devextreme-react/button'
import { DataGrid, Selection, SearchPanel, Column, Export } from 'devextreme-react/data-grid'
import TabPanel, { Item } from 'devextreme-react/tab-panel'

// Helper functions
import { getUploadedSchools } from './UpdateSchoolHelpers/getUploadedSchools'
import getChangedStudents from './UpdateSchoolHelpers/getChangedStudents'
import processStudent from './UpdateSchoolHelpers/processStudent'
//import processStudentClassroom from './UpdateSchoolHelpers/processStudentClassroom'
import { applyOptionsSchoolSpecific } from './CommonHelpers/applyOptionsSchoolSpecific'
import { formatStudentClassrooms } from './NewSchoolHelpers/formatStudentClassrooms'

// Note: We use env-cmd to read .env.local which contains environment variables copied from Amplify
// In production, the environment variables will be loaded automatically by the build script in amplify.yml
// For local starts, the amplify.yml script is not activated, so instead we use "> npm run start:local"
// This first runs the env-cmd that loads the environment variables prior to the main start script

// a fixed afterDate for test purposes
//TODO: calculate this date from last update
//const afterDate = '2022-03-16 00:00:00' // formatted as per Wonde examples

// React component for user to list Wonde schools, read a school and upload the data to EdCompanion
function UpdateSchool() {
  const { loggedIn } = useContext(loggedInContext)
  // school list and slected school
  const [selectedSchool, setSelectedSchool] = useState({ schoolName: 'none' })
  const [schools, setSchools] = useState([])

  // To display the changed students (new students or details changed)
  const [changedStudents, setChangedStudents] = useState([])

  // This one is for the CSV upload display (as per the standard upload spreadsheet)
  const [formattedStudentClassrooms, setFormattedStudentClassrooms] = useState([])
  const [filteredStudentClassrooms, setFilteredStudentClassrooms] = useState([]) // after filters are applied

  // some loading indicators
  const [isLoadingSchools, setIsLoadingSchools] = useState(false)
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false)
  const [schoolDataLoaded, setSchoolDataLoaded] = useState(false)

  // TEST FUNCTION FOR experimentation TO BE REMOVED LATER
  // There is  UI button that will run whatever test is needed
  async function testFunction() {
    console.log('testFuntion() invoked')
    console.log(process.env)
  } // end of testFuntion()

  // Get the list of available schools from Wonde
  async function getAllSchools() {
    // clear state
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

  // Executed if we select a school from the list of schools
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

    console.log('==================================running this from updates...')
    let unfilteredUpdates = await getChangedStudents(selectedSchool, '2022-03-16 00:00:00')
    console.log('==================================end running from updates')

    console.log('No of updated students reported by Wonde', unfilteredUpdates.length)
    console.log('unfiltered updates[0]', unfilteredUpdates[0])

    // filter out unwanted classrooms and years (school specific)
    let filteredUpdates = applyOptionsSchoolSpecific(
      unfilteredUpdates,
      null, // yearOptions known by the school specific routine
      null, // kinterDayClasses known by the school specific routine
      null, // kinterDayClassName known by the school specific routine
      null, // coreSubjectOption known by the school specific routine
      selectedSchool,
    )

    // Apply the CSV format for display
    formatStudentClassrooms(filteredUpdates, null, selectedSchool, setFormattedStudentClassrooms)

    // check each student to look for changes of details like DoB, etc
    // If its a new student the, the new student details are returned
    // If its an existing student with changes, the existing and new student details are returned
    let changedStudents = []
    let promises = filteredUpdates.map(async (student) => {
      let changedStudent = await processStudent(student)
      if (changedStudent.length > 0) {
        changedStudent.forEach((row) => {
          changedStudents.push(row)
        })
      }
    })
    await Promise.all(promises)
    console.log('ChangedStudents for display', changedStudents)
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
                    <Column caption="ID" dataField="id" />
                  </DataGrid>
                )}
              </CRow>
            </CContainer>
          </Item>
          <Item title="students in CSV format">
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
                    dataSource={formattedStudentClassrooms}
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

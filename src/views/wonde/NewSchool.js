import React, { useState, useCallback } from 'react'
import { CContainer, CCol, CRow, CSpinner } from '@coreui/react'
import Button from 'devextreme-react/button'
import { DataGrid, MasterDetail, Selection, SearchPanel } from 'devextreme-react/data-grid'
import TabPanel, { Item } from 'devextreme-react/tab-panel'
import axios from 'axios'
//import _ from 'lodash '
// force change 1

// These are hard-coded for convenience ToDo: Save elsewhere
// const UKURL = 'https://api.wonde.com/v1.0/schools'
// const UKTOKEN = 'Bearer 6c69f7050215eff18895eeb63d6bd0df0545f0da'
// const AUSURL = 'https://api-ap-southeast-2.wonde.com/v1.0/schools'
// const AUSTOKEN = 'Bearer 66018aef288a2a7dadcc53e26e4daf383dbb5e8e'
// const API_URL = 'https://gniisj5nq6.execute-api.ap-southeast-2.amazonaws.com/prod/'
const API_URL = 'https://r5pic75kwf.execute-api.ap-southeast-2.amazonaws.com/prod/'

function NewSchool() {
  const [schools, setSchools] = useState([])
  const [rawStudents, setRawStudents] = useState([])
  const [rawTeachers, setRawTeachers] = useState([])
  const [uniqueClassrooms, setUniqueClassrooms] = useState([]) // list of unique classrooms
  const [rawStudentClassrooms, setRawStudentClassrooms] = useState([])
  const [rawTeacherClassrooms, setRawTeacherClassrooms] = useState([])
  const [selectedSchool, setSelectedSchool] = useState({ schoolName: 'none' })
  const [isLoadingSchools, setIsLoadingSchools] = useState(false)
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false)
  const [schoolDataLoaded, setSchoolDataLoaded] = useState(false)
  const [savingSchoolData, setSavingSchoolData] = useState(false)

  // Read all available schools
  async function getAllSchools() {
    setIsLoadingSchools(true)
    setSchools([])
    setSelectedSchool({ schoolName: 'none' })
    setSchoolDataLoaded(false)
    // when loading the school list we clear teachers, students and assignments
    setRawStudents([])
    setRawTeachers([])
    setRawStudentClassrooms([])
    setRawTeacherClassrooms([])

    let schools = []
    try {
      let response = await axios({
        method: 'get',
        //url: `${process.env.REACT_APP_ENDPOINT}wondeallschools`,
        url: `${API_URL}wondeallschools`,
      })
      response.data.forEach((school) => {
        schools.push(school)
      })
      setSchools(schools)
      setIsLoadingSchools(false)
    } catch (error) {
      console.log(error)
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

  async function saveSchoolDataToEdCompanion() {
    if (!schoolDataLoaded) return // can't save unless data has been loaded
    try {
      let response = await axios({
        method: 'put',
        url: `${API_URL}saveWondeSchool`,
        data: {
          selectedSchool,
          studentList: rawStudents,
          teacherList: rawTeachers,
          uniqueClassroomList: uniqueClassrooms,
        }, // this will go into the request body
      })
      console.log(response)
    } catch (error) {
      console.log(error)
    }
  }

  // gets all students from one school - with teachers and class assignments
  async function getStudents() {
    if (selectedSchool === {}) return
    setRawStudents([])
    setRawStudentClassrooms([])
    setIsLoadingStudents(true)
    let students = []
    let classrooms = []
    let uniqueClassrooms = []
    try {
      let response = await axios({
        method: 'get',
        // url: `${process.env.REACT_APP_ENDPOINT}wondestudents`,
        url: `${API_URL}wondestudents`,
        params: { wondeID: selectedSchool.wondeID },
      })
      // eslint-disable-next-line no-loop-func
      response.data.students.forEach((student) => {
        students.push(student)
      })
      response.data.classrooms.forEach((classroom) => {
        classrooms.push(classroom)
      })
      response.data.uniqueClassrooms.forEach((uniqueClassroom) => {
        uniqueClassrooms.push(uniqueClassroom)
      })
      console.log('no of Unique Classrooms', uniqueClassrooms.length)
      console.log('Unique Classrooms', uniqueClassrooms)
      setRawStudents(students)
      setRawStudentClassrooms(classrooms)
      setUniqueClassrooms(uniqueClassrooms)
      setIsLoadingStudents(false)
      return true
    } catch (error) {
      console.log(error)
      return false
    }
  }

  // get the teachers (employees) list in a school
  // the has_class=true parameter selects employees who are teachers
  async function getTeachers() {
    if (selectedSchool === {}) return
    let teacherClassrooms = []
    let teachers = []
    setIsLoadingTeachers(true)
    setRawTeachers([])
    try {
      let response = await axios({
        method: 'get',
        //url: `${process.env.REACT_APP_ENDPOINT}`,
        url: `${API_URL}wondeteachers`,
        params: { wondeID: selectedSchool.wondeID },
      })
      // eslint-disable-next-line no-loop-func
      response.data.teachers.forEach((teacher) => {
        teachers.push(teacher)
      })
      response.data.classrooms.forEach((classroom) => {
        teacherClassrooms.push(classroom)
      })
      setRawTeachers(teachers)
      setRawTeacherClassrooms(teacherClassrooms)
      setIsLoadingTeachers(false)
      return true
    } catch (error) {
      console.log(error)
      return false
    }
  }

  async function getSchoolData() {
    let teachersLoaded = false
    let studentsLoaded = await getStudents() // students and student-classrooms
    if (studentsLoaded) {
      teachersLoaded = await getTeachers()
    } // teachrs and teacher-classrooms
    if (teachersLoaded && studentsLoaded) setSchoolDataLoaded(true)
  }

  // This is a Detail component to show student-classrooms assignments
  function StudentClassrooms(params) {
    let studentID = params.data.data.id
    let studentClassroomList = rawStudentClassrooms.filter((student) => {
      return student.studentID === studentID
    })

    return (
      <DataGrid
        showBorders={true}
        hoverStateEnabled={true}
        allowColumnReordering={true}
        columnAutoWidth={true}
        dataSource={studentClassroomList}
      ></DataGrid>
    )
  }

  // This is a Detail component to show teacher-classrooms assignments
  function TeacherClassrooms(params) {
    let teacherId = params.data.data.id
    let teacherClassroomList = rawTeacherClassrooms.filter((teacher) => {
      return teacher.teacherId === teacherId
    })

    return (
      <DataGrid
        showBorders={true}
        hoverStateEnabled={true}
        allowColumnReordering={true}
        columnAutoWidth={true}
        dataSource={teacherClassroomList}
      ></DataGrid>
    )
  }

  return (
    <CContainer>
      <CRow>
        <h4 className="text-center">Wonde Integration - New School Uptake (Australia)</h4>
      </CRow>
      <div className="d-flex justify-content-center">
        <Button
          className="btn btn-primary"
          style={{ marginBottom: '10px' }}
          onClick={getAllSchools}
        >
          List All Available Wonde Schools
        </Button>
      </div>
      <CRow>
        <CCol></CCol>
        <CCol>
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
        </CCol>
        <CCol></CCol>
      </CRow>
      <CRow>
        <CCol></CCol>
        <CCol>
          <h6 className="text-center">Selected School:</h6>
        </CCol>
        <CCol>
          <h6 className="text-center">{selectedSchool.schoolName}</h6>
        </CCol>
        <CCol></CCol>
      </CRow>
      <div className="d-flex justify-content-center">
        {selectedSchool.schoolName !== 'none' ? (
          <Button
            className="btn btn-primary"
            style={{ marginBottom: '10px' }}
            onClick={getSchoolData}
          >
            {`Get data for ${selectedSchool.schoolName} from Wonde`}
          </Button>
        ) : null}
      </div>
      <div className="d-flex justify-content-center">
        {schoolDataLoaded ? (
          <Button
            className="btn btn-primary"
            style={{ marginBottom: '10px' }}
            onClick={saveSchoolDataToEdCompanion}
          >
            {`Save data for ${selectedSchool.schoolName} to EdCompanion`}
          </Button>
        ) : null}
      </div>

      <CRow>
        <TabPanel>
          <Item title="Student-Classes">
            <CContainer>
              <CRow>
                {isLoadingStudents ? (
                  <CSpinner />
                ) : (
                  <DataGrid
                    id="dataGrid"
                    keyExpr="id"
                    showBorders={true}
                    hoverStateEnabled={true}
                    allowColumnReordering={true}
                    columnAutoWidth={true}
                    dataSource={rawStudents}
                  >
                    <SearchPanel visible={true} />
                    <MasterDetail enabled={true} component={StudentClassrooms} />
                  </DataGrid>
                )}
              </CRow>
            </CContainer>
          </Item>
          <Item title="Teacher-Classes">
            <CContainer>
              <CRow>
                {isLoadingTeachers ? (
                  <CSpinner />
                ) : (
                  <DataGrid
                    id="dataGrid"
                    keyExpr="id"
                    showBorders={true}
                    hoverStateEnabled={true}
                    allowColumnReordering={true}
                    columnAutoWidth={true}
                    dataSource={rawTeachers}
                  >
                    <SearchPanel visible={true} />
                    <MasterDetail enabled={true} component={TeacherClassrooms} />
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
export default NewSchool

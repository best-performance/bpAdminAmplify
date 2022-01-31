import React, { useState, useCallback } from 'react'
import { CContainer, CCol, CRow, CSpinner } from '@coreui/react'
import Button from 'devextreme-react/button'
import { DataGrid, MasterDetail, Selection, SearchPanel } from 'devextreme-react/data-grid'
import TabPanel, { Item } from 'devextreme-react/tab-panel'
import axios from 'axios'
//import _ from 'lodash '
// force change 1

const API_URL_DEFAULT = 'https://r5pic75kwf.execute-api.ap-southeast-2.amazonaws.com/prod/' // apigateway for lambdas

// pick the right API url for the deployed region FEATURE_TOGGLE
const URL = process.env.REACT_APP_ENDPOINT
  ? `${process.env.REACT_APP_ENDPOINT}`
  : `${API_URL_DEFAULT}`

// React component for user to list Wonde schools, read a school and upload the data to EdCompanion
function NewSchool() {
  const [schools, setSchools] = useState([])
  const [rawStudents, setRawStudents] = useState([])
  const [rawTeachers, setRawTeachers] = useState([])
  const [rawStudentClassrooms, setRawStudentClassrooms] = useState([])
  const [rawTeacherClassrooms, setRawTeacherClassrooms] = useState([])
  const [selectedSchool, setSelectedSchool] = useState({ schoolName: 'none' })
  const [isLoadingSchools, setIsLoadingSchools] = useState(false)
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false)
  const [schoolDataLoaded, setSchoolDataLoaded] = useState(false)

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
        url: `${URL}wondeallschools`,
      })
      console.log(response)
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
    //TODO Urgent - 29/01/2022
    // Consider what classroom data to send for saving by saveWondeSchool lambda
    // We have 2 classroom lists
    //    1) List of classrooms attended by each student, which includes yearLevel and LearningArea
    //    2) List of classroom taught by each teacher, which includes learningArea

    //    In the saveWondeSchool lambda we need to fill in 5 tables related to classrooms
    //        Classrooms             - a unique list of Classrooms
    //        ClassroomYearLevel     - classroomID, yearlevelID
    //        ClassroomLearningArea  - classroomID, learningAreaID
    //        ClassroomTeacher       - classroomID, teacherID
    //        ClassroomStudent       - classroomID, studentID
    //   Steps
    //    1) Make a unique classroom list from rawTeacherClassrooms and rawStudentClassrooms
    //    2) Verify the list is consistent
    //    3) Make minimal lists to end to the lambda
    if (!schoolDataLoaded) return // can't save unless data has been loaded

    //console.log('no of raw classrooms', rawStudentClassrooms.length)
    let uniqueStudentClassrooms = new Map()
    rawStudentClassrooms.forEach((classroom) => {
      if (!uniqueStudentClassrooms.get(classroom.wondeClassroomId)) {
        uniqueStudentClassrooms.set(classroom.wondeClassroomId, classroom)
      }
    })

    // 1) Make a unique classroom list from rawTeacherClassrooms and rawStudentClassrooms
    let uniqueTeacherClassrooms = new Map()
    rawTeacherClassrooms.forEach((classroom) => {
      if (!uniqueTeacherClassrooms.get(classroom.wondeClassroomId))
        uniqueTeacherClassrooms.set(classroom.wondeClassroomId, classroom)
    })

    // 2) Verify the list is consistent
    uniqueStudentClassrooms.forEach((classroom) => {
      if (!uniqueTeacherClassrooms.get(classroom.wondeClassroomId))
        console.log(`${classroom} not found in teacherClassroom list`)
    })
    uniqueTeacherClassrooms.forEach((classroom) => {
      if (!uniqueStudentClassrooms.get(classroom.wondeClassroomId))
        console.log(`${classroom} not found in studentClassroom list`)
    })
    // conver list to an array
    let uniqueClassrooms = Array.from(uniqueStudentClassrooms.values())

    let minmalUniqueClassrooms = uniqueClassrooms.map((classroom) => {
      return {
        wondeClassroomId: classroom.wondeClassroomId,
        mis_id: classroom.mis_id,
        classroomLearningArea: classroom.classroomLearningArea,
        classroomName: classroom.classroomName,
        yearLevel: classroom.yearLevel,
      }
    })

    let minimalTeacherClassrooms = rawTeacherClassrooms.map((teacherClassroom) => {
      return {
        wondeTeacherId: teacherClassroom.wondeTeacherId,
        wondeClassroomId: teacherClassroom.wondeClassroomId,
      }
    })

    let minimalStudentClassrooms = rawStudentClassrooms.map((studentClassroom) => {
      return {
        wondeStudentId: studentClassroom.wondeTeacherId,
        wondeClassroomId: studentClassroom.wondeClassroomId,
      }
    })

    console.log('minimalUnique Classrooms', minmalUniqueClassrooms)
    console.log('minimalTeacherClassrooms', minimalTeacherClassrooms)
    console.log('minimalStudentClassrooms', minimalStudentClassrooms)

    // send to save in Dynamo tables
    try {
      let response = await axios({
        method: 'put',
        url: `${URL}saveWondeSchool`,
        data: {
          selectedSchool,
          studentList: rawStudents,
          teacherList: rawTeachers,
          teacherClassroomList: minimalTeacherClassrooms,
          studentClassroomList: minimalStudentClassrooms,
          uniqueClassroomList: uniqueClassrooms,
        }, // this will go into the request body
      })
      console.log(response)
    } catch (error) {
      console.log(error)
    }
  } // end saveSchoolDataToEdCompanion()

  // gets all students from one school - with teachers and class assignments
  async function getStudents() {
    if (selectedSchool === {}) return
    setRawStudents([])
    setRawStudentClassrooms([])
    setIsLoadingStudents(true)
    let students = []
    let classrooms = []
    try {
      let response = await axios({
        method: 'get',
        url: `${URL}wondestudents`,
        params: { wondeID: selectedSchool.wondeID },
      })
      // eslint-disable-next-line no-loop-func
      response.data.students.forEach((student) => {
        students.push(student)
      })
      response.data.classrooms.forEach((classroom) => {
        classrooms.push(classroom)
      })
      setRawStudents(students)
      setRawStudentClassrooms(classrooms)
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
        url: `${URL}wondeteachers`,
        //url: `${API_URL}wondeteachers`,
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

  // wrapper funtion triggered by "Get data for ..." button to read all school data
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
    let studentID = params.data.data.wondeStudentId
    let studentClassroomList = rawStudentClassrooms.filter((student) => {
      return student.wondeStudentID === studentID
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
    let teacherId = params.data.data.wondeTeacherId
    let teacherClassroomList = rawTeacherClassrooms.filter((teacher) => {
      return teacher.wondeTeacherId === teacherId
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
        <h4 className="text-center">Wonde Integration - New School Uptake</h4>
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
                    keyExpr="wondeStudentId"
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
                    keyExpr="wondeTeacherId"
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

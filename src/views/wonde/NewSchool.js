import React, { useEffect, useState, useCallback, useContext } from 'react'
import loggedInContext from 'src/loggedInContext'
import { CContainer, CCol, CRow, CSpinner } from '@coreui/react'
import Button from 'devextreme-react/button'
import { DataGrid, MasterDetail, Selection, SearchPanel } from 'devextreme-react/data-grid'
import TabPanel, { Item } from 'devextreme-react/tab-panel'
import axios from 'axios'
import dayjs from 'dayjs'
import _ from 'lodash'
import { Auth } from 'aws-amplify'
import AWS from 'aws-sdk'
import { v4 } from 'uuid'
// Helper functions
import { getAllSchoolsFromWonde } from './helpers/getAllSchoolsFromWonde'
import { saveSchool } from './helpers/saveSchool' // save it if it does not already exist in table School
import { deleteSchoolDataFromDynamoDB } from './helpers/deleteSchoolDataFromDynamoDB'
import { updateAWSCredentials } from './helpers/updateAWSCredentials'
import { addNewUser, handleUserCreation } from './helpers/cognitoFns'
import { batchWrite } from './helpers/batchWrite'

// Note: We are now using env-cmd to read the hardcoded env variables copied from the Amplify environment variables
// The environment variables will be loaded automatically by the build script in amplify.yml when the app is being
// deployed. But for local starts, the build script is not activated, so instead we use ""> npm run start:local"
// which first runs the env-cmd that loads the environment variables prior to the main start script

// These are hard-coded for convenience ToDo: Save elsewhere
const UKURL = 'https://api.wonde.com/v1.0/schools'
const UKTOKEN = 'Bearer a3f049794493180ed83fb310da37715f856c3670' // new as of 9/2/2022
const AUSURL = 'https://api-ap-southeast-2.wonde.com/v1.0/schools'
const AUSTOKEN = 'Bearer 4ef8fc0053696f4202062ac598943fc1de66c606' // new as of 9/2/2022

//Lookup tables
const COUNTRY_TABLE = 'Country'
const STATE_TABLE = 'State'
const LEARNINGAREA_TABLE = 'LearningArea'
const YEARLEVEL_TABLE = 'YearLevel'

// Tables to store school data
// We need to generalise this for regional table names
// Maybe to a dynamo query to list the available table names?
const SCHOOL_TABLE = 'Schools'
const STUDENT_TABLE = 'Student'
const USER_TABLE = 'User'
const SCHOOL_STUDENT_TABLE = 'SchoolStudent'
const CLASSROOM_TABLE = 'Classroom'
const CLASSROOM_TEACHER_TABLE = 'ClassroomTeacher'
const CLASSROOM_STUDENT_TABLE = 'ClassroomStudent'
const CLASSROOM_YEARLEVEL_TABLE = 'ClassroomYearLevel'
const CLASSROOM_LEARNING_AREA_TABLE = 'ClassroomLearningArea'
const STUDENT_DATA_TABLE = 'StudentData'

const SCHOOL_GSI_INDEX = 'wondeIDIndex'

// React component for user to list Wonde schools, read a school and upload the data to EdCompanion
function NewSchool() {
  const { loggedIn } = useContext(loggedInContext)
  // school list and slected school
  const [selectedSchool, setSelectedSchool] = useState({ schoolName: 'none' })
  const [schools, setSchools] = useState([])

  // These 2 save the raw data as loaded from Wonde
  const [wondeStudents, setWondeStudents] = useState([])
  const [wondeTeachers, setWondeTeachers] = useState([])

  // Next four are for the steduent-teacher and classroom-teacher displays
  const [displayStudents, setDisplayStudents] = useState([])
  const [displayTeachers, setDisplayTeachers] = useState([])
  const [displayStudentClassrooms, setDisplayStudentClassrooms] = useState([])
  const [displayTeacherClassrooms, setDisplayTeacherClassrooms] = useState([])

  // This one is for the upload display (as per the standard upload spreadsheet)
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
  const [statesLookup, setStatesLookup] = useState([])
  const [learningAreasLookup, setLearningAreasLookup] = useState([])
  const [yearLevelsLookup, setYearLevelsLoookup] = useState([])

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
        region: 'ap-southeast-2',
      })
      const docClient = new AWS.DynamoDB.DocumentClient()
      let response
      response = await docClient.scan({ TableName: COUNTRY_TABLE }).promise()
      setCountriesLookup(response.Items)
      response = await docClient.scan({ TableName: STATE_TABLE }).promise()
      setStatesLookup(response.Items)
      response = await docClient.scan({ TableName: LEARNINGAREA_TABLE }).promise()
      setLearningAreasLookup(response.Items)
      response = await docClient.scan({ TableName: YEARLEVEL_TABLE }).promise()
      setYearLevelsLoookup(response.Items)
    }
    console.log('in useEffect2')
    getLookupData()
  }, [])

  // FEATURE-TOGGLE
  function getURL() {
    //return UKURL
    switch (process.env.REACT_APP_REGION) {
      case 'ap-southeast-2':
        return AUSURL
      case 'eu-west-2':
        return UKURL
      default:
        return AUSURL
    }
  }
  // FEATURE-TOGGLE
  function getToken() {
    //return UKTOKEN
    switch (process.env.REACT_APP_REGION) {
      case 'ap-southeast-2':
        return AUSTOKEN
      case 'eu-west-2':
        return UKTOKEN
      default:
        return AUSTOKEN
    }
  }

  // TEST FUNCTION FOR experimentation TO BE REMOVED LATER
  // There is  UI button that will run the function
  // Any sort of test function here is acceptable
  async function testFunction() {
    console.log('testFuntion() invoked')
    //console.log('Countries', countriesLookup)
    //console.log('States', statesLookup)
    console.log('yearLevels', yearLevelsLookup)
    //console.log('learningAreas', learningAreasLookup)

    // this function will add a record to the test Cognito pool
    console.log('environment variables available')
    console.log(`REGION ${process.env.REACT_APP_REGION}`) //
    console.log(`USER_POOL_ID ${process.env.REACT_APP_USER_POOL_ID}`) //
    console.log(`USER_POOL_CLIENT_ID ${process.env.REACT_APP_USER_POOL_CLIENT_ID}`) //
    console.log(`ENDPOINT ${process.env.REACT_APP_ENDPOINT}`) //
    console.log(`IDENTITY_POOL(_ID) ${process.env.REACT_APP_IDENTITY_POOL}`)
    console.log(`USER_POOL_ID2 ${process.env.REACT_APP_USER_POOL_ID2}`)
    console.log(`USER_POOL_CLIENT_ID2 ${process.env.REACT_APP_USER_POOL_CLIENT_ID2}`)

    // for (let n = 20; n < 25; n++) {
    //   await addNewUser(`testUser${n + 1}@BPAdmin.com.au`, process.env.REACT_APP_USER_POOL_ID2)
    // }
  }

  // Invokes function to get the list of available schools from Wonde
  // first clears all state
  async function getAllSchools() {
    setIsLoadingSchools(true)
    setSchools([])
    setSelectedSchool({ schoolName: 'none' })
    setSchoolDataLoaded(false)
    // when loading the school list we clear teachers, students and classrooms
    setDisplayStudents([])
    setDisplayTeachers([])
    setDisplayStudentClassrooms([])
    setDisplayTeacherClassrooms([])

    // back to the business of this function
    let schools = await getAllSchoolsFromWonde(getURL(), getToken())
    if (schools) {
      setSchools(schools)
      setIsLoadingSchools(false)
    } else {
      console.log('could not read schools from Wonde')
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

  // gets the students list from one school - with classrooms and teachers
  // Note - This has been removed from lambda due to the fluidity of filtering
  // requirements so we are querying Wonde directly and filtering in browser
  // at least during development
  async function getStudents(wondeSchoolID) {
    let wondeStudentsTemp = [] // the data as received from Wonde
    let students = []
    let classrooms = []
    let noClassesCount = 0 // debug message to flag students with no clasrooms
    setIsLoadingStudents(true)
    try {
      let URL = `${getURL()}/${wondeSchoolID}/students?include=classes.employees,year&per_page=200`
      let morePages = true
      while (morePages) {
        console.log(URL)
        let response = await axios({
          method: 'get',
          url: URL,
          headers: {
            Authorization: getToken(),
          },
        })
        // eslint-disable-next-line no-loop-func
        response.data.data.forEach((student) => {
          wondeStudentsTemp.push(student) // save the original response data
          // only add classroom entries if the student is assigned to a class
          if (student.classes.data.length > 0) {
            student.classes.data.forEach((classroom) => {
              classrooms.push({
                wondeStudentId: student.id,
                mis_id: classroom.mis_id,
                wondeClassroomId: classroom.id,
                classroomName: classroom.name,
                yearLevel: student.year.data.code,
                teacherId:
                  classroom.employees.data.length > 0
                    ? classroom.employees.data[0].id
                    : 'no teacher',
              })
            })
          } else {
            noClassesCount++ // for debugging only
          }
          let dob = 'XXXX-XX-XX'
          if (student.date_of_birth && student.date_of_birth.date) {
            dob = dayjs(student.date_of_birth.date).format('DD/MMM/YYYY')
          }
          students.push({
            wondeStudentId: student.id,
            mis_id: student.mis_id,
            firstName: student.forename,
            lastName: student.surname,
            gender: student.gender ? student.gender : 'X',
            dob: dob,
            year: student.year.data.code,
          })
        })
        // check if all pages are read
        if (response.data.meta.pagination.next != null) {
          URL = response.data.meta.pagination.next
        } else {
          morePages = false
        }
      }
    } catch (error) {
      console.log(error)
    }
    console.log('no of students', students.length)
    console.log('no of classrooms', classrooms.length)
    console.log('no of students with no classrooms', noClassesCount)
    students = _.sortBy(students, (y) => parseInt(y.year))

    setWondeStudents(wondeStudentsTemp) // save the raw response in case needed
    setDisplayStudents(students)
    setDisplayStudentClassrooms(classrooms)
    setIsLoadingStudents(false)
    return { wondeStudentsTemp: wondeStudentsTemp }
  }

  // gets the teachers from one school, with their contact details
  // Note - This has been rmeoved from lambda due to the fluidity of filtering
  // requirements so we are querying Wonde directly and filtering in browser
  // where its easy and fast,
  async function getTeachers(wondeSchoolID) {
    let wondeTeachersTemp = []
    let classrooms = [] // only classrooms from teh core 4 learning areas
    let teachers = [] // only teachers that teach at least one of the 4 core learning areas
    setIsLoadingTeachers(true)
    try {
      let URL = `${getURL()}/${wondeSchoolID}/employees/?has_class=true&include=contact_details,classes&per_page=200`
      let morePages = true
      while (morePages) {
        console.log(URL)
        let response = await axios({
          method: 'get',
          url: URL,
          headers: {
            Authorization: getToken(),
          },
        })
        // eslint-disable-next-line no-loop-func
        response.data.data.forEach((employee) => {
          wondeTeachersTemp.push(employee) // save the original response data
          // under new rules we load all teachers and their classrooms
          employee.classes.data.forEach((classroom) => {
            let learningArea = getLearningArea(classroom.name) // returns either false or the learning Area
            // under new rules we allows all teachers even if not core 4
            classrooms.push({
              wondeTeacherId: employee.id,
              wondeClassroomId: classroom.id,
              classroomName: classroom.name,
              classroomLearningArea: learningArea ? learningArea : null, // return learning area if available
            })
          })
          // under new rules we load all teachers
          teachers.push({
            wondeTeacherId: employee.id,
            mis_id: employee.mis_id,
            title: employee.title,
            firstName: employee.forename,
            lastName: employee.surname,
            email: employee.contact_details.data.emails.email,
          })
        })
        // check if all pages are read
        if (response.data.meta.pagination.next != null) {
          URL = response.data.meta.pagination.next
        } else {
          morePages = false
        }
      }
    } catch (error) {
      console.log('error reading Wonde teachers', error.message)
      return { result: false, msg: error.message }
    }
    setWondeTeachers(wondeTeachersTemp)
    setDisplayTeachers(teachers)
    setDisplayTeacherClassrooms(classrooms)
    setIsLoadingTeachers(false)
    return { wondeTeachersTemp: wondeTeachersTemp }
  }

  // wrapper funtion triggered by "Get data for ..." button to read all school data
  async function getSchoolData() {
    if (selectedSchool === {}) return
    let { wondeStudentsTemp } = await getStudents(selectedSchool.wondeID) // students and student-classrooms
    let { wondeTeachersTemp } = await getTeachers(selectedSchool.wondeID)
    formatStudentClassrooms(wondeStudentsTemp, wondeTeachersTemp) // this is for the uploader format
    setSchoolDataLoaded(true)
  }

  // This is for testing to delete all records form the Dynamo tables if they exist
  async function deleteAllTables() {
    await deleteSchoolDataFromDynamoDB()
  }

  // This is the new function to save a school to edComapnion based on the filtered CSV data
  async function saveSchoolCSVtoDynamoDB() {
    // see doco of old loader at end of file
    if (!schoolDataLoaded) return // can't save unless data has been loaded
    console.log('Saving School to DynamoDB')

    /**
     * Save the selected school to School table if not already saves
     * returns the EC schoolID of the saved school
     */
    let schoolID // the EC id of the saved School
    try {
      schoolID = await saveSchool(selectedSchool, countriesLookup, SCHOOL_TABLE, SCHOOL_GSI_INDEX)
      console.log('School saved', schoolID)
    } catch (err) {
      console.log('error saving school', err)
    }

    //From here we assume [FilteredStudentClassrooms] contains filtered data
    //We can scan it to get unique classrooms, teachers and students for upload
    // Each row represents a student, a classroom and up to 5 teachers
    let uniqueClassroomsMap = new Map()
    let uniqueTeachersMap = new Map()
    let uniqueStudentsMap = new Map()

    filteredStudentClassrooms.forEach((row) => {
      // Unique list of classrooms
      if (!uniqueClassroomsMap.get(row.CwondeId)) {
        uniqueClassroomsMap.set(row.CwondeId, {
          wondeId: row.CwondeId, // not in EdC
          className: row.classroomName,
          yearCode: row.yearCode,
        })
      }
      // Unique list of students
      if (!uniqueStudentsMap.get(row.SwondeId)) {
        uniqueStudentsMap.set(row.SwondeId, {
          wondeId: row.SwondeId, // not in EdC
          firstName: row.firstName,
          lastName: row.lastName,
          yearCode: row.yearCode,
          gender: row.gender,
          dob: row.dob,
        })
      }
      // Unique list of teachers
      for (let n = 0; n < 4; n++) {
        let wondeId = `T${n + 1} WondeId`
        let fnameKey = `teacher${n + 1} FirstName`
        let lnameKey = `teacher${n + 1} LastName`
        let emailKey = `teacher${n + 1} email`
        if (row[wondeId] !== '-') {
          // mostly they are empty ie 1 teacher
          if (!uniqueTeachersMap.get(row[wondeId])) {
            uniqueTeachersMap.set(row[wondeId], {
              wondeId: row[wondeId], // not in EdC
              firstName: row[fnameKey],
              lastName: row[lnameKey],
              email: row[emailKey],
            })
          }
        }
      }
    })
    // // see what emerges (note ANZ has all filtered out except year 10)
    // console.dir(uniqueClassroomsMap)
    // console.dir(uniqueTeachersMap)
    // console.dir(uniqueStudentsMap)

    const uniqueClassroomsArray = Array.from(uniqueClassroomsMap.values())
    const uniqueTeachersArray = Array.from(uniqueTeachersMap.values())
    const uniqueStudentsArray = Array.from(uniqueStudentsMap.values())
    console.dir(uniqueClassroomsArray)
    console.dir(uniqueTeachersArray)
    console.dir(uniqueStudentsArray)

    /**
     * Save the classrooms
     * For each classroom
          add to classrooms *
          add to classroomYearLevel
	        add to classroomLearningArea
     */
    const BATCH_SIZE = 25
    try {
      console.time('Saved Classrooms') // measure how long it takes to save
      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      let batchesCount = parseInt(uniqueClassroomsArray.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = uniqueClassroomsArray.length % BATCH_SIZE // which could be 0
      // eg if 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

      // process each batch
      let index = 0 //index to uniqueClassroomsArray
      for (let i = 0; i < batchesCount; i++) {
        let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
        if (batchSize === 0) break // must have been an even no of batches

        let batchToWrite = []
        for (let n = 0; n < batchSize; n++) {
          let id = v4()
          batchToWrite.push({
            PutRequest: {
              Item: {
                id: id, // this is the EdC id generated locally
                classType: 'Classroom',
                // focusGroupType: null, // its not a focus group
                className: uniqueClassroomsArray[index].className,
                schoolYear: '2022', // hardcoded for now
                schoolID: schoolID, // not in Wonde - generated above when saving the school
                wondeId: uniqueClassroomsArray[index].wondeId, // not in EdC
                mis_id: 'to be included', // not in EdC
                __typename: 'Classroom', // used hard coded as tableName may change with env
                createtAt: dayjs().format('YYYY-MM-DD HH-mm-sss'),
                updatedAt: dayjs().format('YYYY-MM-DD HH-mm-sss'),
                // other optional fields not uploaded
                // focusGroupType
              },
            },
          })

          uniqueClassroomsArray[index].classroomID = id // add teh generate EC id for user below
          index++
        } // end batch loop

        console.log(`writing batch ${i} batchsize ${batchToWrite.length}`)
        let response = await batchWrite(batchToWrite, CLASSROOM_TABLE)
        console.log(response)

        if (!response.result) {
          console.log(`exiting at index ${index}`)
          break
        }
      } // end array loop
      console.timeEnd('Saved Classrooms')
    } catch (err) {
      console.log(err)
    } // end saving classrooms

    /**
     * Save the classrooms
     * For each classroom
          add to classrooms
          add to classroomYearLevel *
	        add to classroomLearningArea
     */
    // Classrooms saves - next save classroomYearLevels
    console.log('saving ClassroomYearLevels')
    try {
      console.time('Saved ClassroomYearLevels') // measure how long it takes to save
      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      let batchesCount = parseInt(uniqueClassroomsArray.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = uniqueClassroomsArray.length % BATCH_SIZE // which could be 0
      // eg if 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

      // process each batch
      let index = 0 //index in the classrooms array
      for (let i = 0; i < batchesCount; i++) {
        let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
        if (batchSize === 0) break // must have been an even no of batches

        let batchToWrite = []
        for (let n = 0; n < batchSize; n++) {
          // lookup the yearLevelID to save
          console.log(
            'uniqueClassroomsArray[index].yearCode',
            uniqueClassroomsArray[index].yearCode,
          )
          let yearLevelRecord = yearLevelsLookup.find(
            // eslint-disable-next-line no-loop-func
            (o) => uniqueClassroomsArray[index].yearCode === o.yearCode,
            // Note yearCode looks like "Y0" to "Y12", Y0 = "FY", other = "K" (kindy)
          )

          //console.log("yearLevelRecord", yearLevelRecord);
          batchToWrite.push({
            PutRequest: {
              Item: {
                id: v4(), // this is the EdC id generated locally
                classroomID: uniqueClassroomsArray[index].classroomID, // as poked in saving the classroom
                schoolID: schoolID, // not in Wonde - generated above when saving the school
                yearLevelID: yearLevelRecord.id,
                __typename: 'ClassroomYearLevel',
                createtAt: dayjs().format('YYYY-MM-DD HH-mm-sss'),
                updatedAt: dayjs().format('YYYY-MM-DD HH-mm-sss'),
              },
            },
          })
          index++
        } // end batch loop

        //console.log(`writing batch ${i} batchsize ${batchToWrite.length}`);
        let response = await batchWrite(batchToWrite, CLASSROOM_YEARLEVEL_TABLE)
        //console.log(response);

        if (!response.result) {
          console.log(`exiting at index ${index}`)
          break
        }
      } // end array loop
      console.timeEnd('Saved ClassroomYearLevels')
    } catch (err) {
      console.log(err)
      return { result: false, msg: err.message } // abandon ship
    } // end save classrommYearLevel

    /**
     * Save the students
     * (NB: all students irrespective of classroom assignments)
     * Create a record in Student for each unique student
     * Create a record in SchoolStudent for every unique student
     */
    //saveStudents(schoolID, wondeStudents, STUDENT_TABLE, CLASSROOM_STUDENT_TABLE)
  }

  // find a class's learning Area (relocated from the lambda)
  function getLearningArea(className) {
    // must be one of Mathematics, English, Technology, Science
    let classNameUpper = className.toUpperCase()
    if (classNameUpper.includes('MATH')) {
      return 'Mathematics'
    }
    if (classNameUpper.includes('ENGL')) {
      return 'English'
    }
    if (classNameUpper.includes('SCI')) {
      return 'Science'
    }
    if (classNameUpper.includes('TECHN') || classNameUpper.includes('IT APP')) {
      return 'Technology'
    }
    return false
  }

  // This displays data in the same format as we would use in the manual uploader
  // was an afterthought - so overall processing looks convoluted
  function formatStudentClassrooms(wondeStudents, wondeTeachers) {
    console.log('Wonde Students', wondeStudents)
    console.log('wondeTeachers', wondeTeachers)

    let studentClassroomsTmp = []
    wondeStudents.forEach((student) => {
      let studentPart = {}
      // first put defaults for gender and dob if they are missing ( often they are)
      let gender = 'X'
      if (student.gender && student.gender !== 'X') gender = student.gender.charAt(0)
      let dob = 'XXXX-XX-XX'
      if (dayjs(student.date_of_birth.date).isValid())
        dob = dayjs(student.date_of_birth.date).format('DD/MM/YYYY')

      // we have to try to get a good year level
      let yearCode
      let num = student.year.data.code.match(/\d+/) // is it a number?
      if (num) {
        if (num > 0 && num < 14) {
          yearCode = `Y${num.toString()}`
        } else {
          if (num === 0) {
            yearCode = 'FY' // for Foundation Year
          } else {
            yearCode = 'UNKNOWN' // and filter them out later
          }
        }
      } else {
        // We can test for known strings here (when we know them!)
        yearCode = 'UNKNOWN' // and filter them out later
      }

      studentPart.SwondeId = student.id // need to make unique list for upload
      studentPart.firstName = student.forename
      studentPart.lastName = student.surname
      studentPart.yearCode = yearCode // like Yn or K or FY
      studentPart.gender = gender
      studentPart.dateOfBirth = dob

      // now process the classrooms - could has no classroom assigned
      student.classes.data.forEach((classroom) => {
        let classroomPart = {}
        classroomPart.CwondeId = classroom.id // need to make unique list for upload
        classroomPart.classroomName = classroom.name
        // now process the teacher(s) - may be none, 1, multiple teachers per classroom

        // First make dummy columns for the teachers (up to 4 teachers)
        // If we dont this DevExtreme will only display the number of teachers in the first record!
        for (let n = 0; n < 4; n++) {
          let wondeId = `T${n + 1} WondeId`
          let fnameKey = `teacher${n + 1} FirstName`
          let lnameKey = `teacher${n + 1} LastName`
          let emailKey = `teacher${n + 1} email`
          classroomPart[wondeId] = '-'
          classroomPart[fnameKey] = '-'
          classroomPart[lnameKey] = '-'
          classroomPart[emailKey] = '-'
        }
        // now populate teacher columns
        classroom.employees.data.forEach((teacher, index) => {
          // find the email address from wondeTeachersTemp
          let email = 'placeholder'
          let teacherID = teacher.id
          let teacherRec = wondeTeachers.find((teacher) => teacher.id === teacherID)
          if (teacherRec) {
            email = teacherRec.contact_details.data.emails.email
          }
          // Note: Keys generated dynamically using the array notation[]
          let fnameKey = `teacher${index + 1} FirstName`
          let lnameKey = `teacher${index + 1} LastName`
          let emailKey = `teacher${index + 1} email`
          let wondeId = `T${index + 1} WondeId`
          classroomPart[fnameKey] = teacher.forename
          classroomPart[lnameKey] = teacher.surname
          classroomPart[emailKey] = email
          classroomPart[wondeId] = teacher.id
        })
        studentClassroomsTmp.push({ ...studentPart, ...classroomPart })
      })

      //})
    })
    setStudentClassrooms(studentClassroomsTmp) // for display in "upload Format" tab
    setFilteredStudentClassrooms(applyFilters(studentClassroomsTmp)) // for dsplay in "upload Format filtered" tab
  }

  // This filters the studentclassroom list to remove unwanted records
  // Filter Rules:
  //    Remove records for years 30 and 40
  //    Year Level must be like "5" not "year 5"
  //    Date format? some sheets show 21/12/2021 and others 2021/12/21
  //    Only subject based classrom names  English, mathematics and Science are allowed
  //    Add year level to the start of Classroom names - like "5 English"
  //    Remove duplicates for year 0 students ( ie classroom day split into periods)
  function applyFilters(listToFilter) {
    let filteredList = []
    // only keep Maths, English and Science
    filteredList = listToFilter.filter((item) => {
      return (
        item.yearCode !== 'UNKNOWN' &&
        (item.classroomName === 'Mathematics' ||
          item.classroomName === 'English' ||
          item.classroomName === 'Science')
      )
    })

    return filteredList
  } // end function applyFilters()

  // This is a Detail component to show student-classrooms assignments
  function StudentClassrooms(params) {
    let studentId = params.data.data.wondeStudentId
    let studentClassroomList = displayStudentClassrooms.filter((student) => {
      return student.wondeStudentId === studentId
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
    let teacherClassroomList = displayTeacherClassrooms.filter((teacher) => {
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
        <Button className="btn btn-primary" style={{ marginBottom: '10px' }} onClick={testFunction}>
          run testFunction()
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
          <>
            <Button
              className="btn btn-primary"
              style={{ marginBottom: '10px' }}
              onClick={saveSchoolCSVtoDynamoDB}
            >
              {`Save data for ${selectedSchool.schoolName} to EdCompanion`}
            </Button>
            <Button
              className="btn btn-primary"
              style={{ marginBottom: '10px' }}
              onClick={deleteAllTables}
            >
              {`Delete data for ${selectedSchool.schoolName} from EdCompanion`}
            </Button>
          </>
        ) : null}
      </div>

      <CRow>
        <TabPanel>
          <Item title="csv format - raw">
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
                    dataSource={studentClassrooms}
                  >
                    <SearchPanel visible={true} />
                  </DataGrid>
                )}
              </CRow>
            </CContainer>
          </Item>
          <Item title="csv format - filtered">
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
                  </DataGrid>
                )}
              </CRow>
            </CContainer>
          </Item>
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
                    dataSource={displayStudents}
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
                    dataSource={displayTeachers}
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
/**
 * Notes:
 * The code calling teh existing lambda has a loop that is called onece for every "classroom"
 * Im not sure what a classroom data structure is - but probably is either
 * a) One line of the csv ( most probable)
 * b) grouped lines of the CSV
 * b) an invesion of the CSV data that shows classrooms
 */
/**
 * Pseudo code for Frank's old loader in EdCompanion
 * Passed in a datastructure that includes the classroom
 * The sequence is
 * a) GetClassroom() - reads or creates the classroom
 * b) process the teachers
 * c) process the students
 *
 * In Depth
 * a) Get or create the classroom based on schoolID, schoolYear and classname (GetClassroom())
 *    check if the classroom exists ( based on schoolID, schoolYear, classname - unique!)
 *          if creating a classroom
 *              for each year level in the classroom
 *                create classroomYearLevel entries
 *          if classroom already exists
 *              for each year level in the classroom
 *                    lookup the yearlevel ID
 *                     check if the classroom year level exists
 *                      if it does not exist
 *                            create the classroomYearlevel for that classroom
 *
 * b) process teachers
 *    for every teacher in the classroom
 *        call getTeacher(email) returns either null or the User entry
 *        if Null
 *           create the teacher createTeacher() - see details
 *        save the UserId
 *        if the teacher is found but the schoolID has changed AND its the current year
 *           update the User record to teh new schoolID (updateTeacher(teacher, schoolID))
 *        if the classroomTeacher record does not exist
 *           create the classroomTeacherRecord
 *
 *     createTeacher(teacher,schoolID) details
 *        if the cognitoUser does not exist
 *            create the Cognito user
 *            adding user to the  Users group
 *        add the teacher to the User table
 *
 * c) Process the students
 *    for every student in the classroom
 *        check if the students exists (by firstname, lastname, birthdate)
 *
 *        if the student does not exist
 *           change the birthdate format
 *           check again if the student exists
 *           if the student now exists
 *              update the birthdate in the Student table
 *
 *        get the yearLevel code for the student
 *
 *        if the student (still) does not exist
 *            create the record in Student table
 *
 *        if the student already exists
 *            update the record in Student table - including yearLevelID
 *
 *        when we reach here the student record exists!!
 *
 *        check if there is a record in SchoolStudent table
 *        if SchoolStudent record not exists
 *           create the record in SchoolStudent
 *        if exists
 *           if studentYearLevel is wrong - say a previous year
 *               update the studentYearlevel in Student table
 *
 *        check if there is a record in StudentData for that student for this year
 *            if no data
 *               check if there is a record in StudentData for that student for previous year
 *                  if data exists for previous year
 *                      carry over the data to the current year
 *
 *        check if there is already a record in studentClassroom - search by classroomID, studentID
 *            if no matching studentClassroom record
 *                 add the record to studentClassroom
 *
 *
 *  Suggested psedo code for Wonde uploader and updater
 *  Notes:
 *  1) We can extract data from Wonde in whatever way we like but start with this:
 *    school
 *     students ( a school can have many students)
 *       classrooms ( a student can belong to multiple classrooms)
 *          teachers ( a classroom can have multiple teachers)
 *
 *    First apply filter rules to:
 *       remove classrooms of no interest
 *       remove duplicate classrooms (esp Infant)
 *       convert yearLevel code
 *       make composite classroom names ( like "5 English")
 *
 *    First the new school case.......
 *    for every unique student (based on WondeID)
 *       verify the student does not exist in Student table (index wondeID#schoolID) - note could still be a duplicate name,birthdate from another non-Wonde school!
 *          if student not exists
 *              create the Student record ( look up the yearLevelID)
 *              create the SchoolStudent record
 *       verify the student is not already in Cognito
 *          if not in cognito
 *              add the student to Cognito, group Users
 *
 *   for every unique classroom ( based on WondeID)
 *
 *
 */

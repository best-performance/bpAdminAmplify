import dayjs from 'dayjs'
import _ from 'lodash'
import { getGender } from '../CommonHelpers/getGender'
import { getNumericYearLevel } from '../CommonHelpers/getNumericYearLevel'

// This formats either raw or filtered Wonde data into CSV format
// matching the original csv upload files
export function formatStudentClassrooms(
  wondeStudents,
  selectedSchool,
  setResultStateVariable, // Either setStudentClassrooms | setFilteredStudentClassrooms
) {
  console.log('Wonde Student[0]', wondeStudents[0])

  let studentClassroomsTmp = []
  wondeStudents.forEach((student) => {
    //console.log('student', student)
    let studentPart = {}
    // first put defaults for gender and dob if they are missing ( often they are)
    // Converting the original wonde values set for gender,dob to the ones required by the CSV upload format
    let gender = getGender(student.gender)

    let dob
    if (dayjs(student.date_of_birth.date).isValid())
      dob = dayjs(student.date_of_birth.date).format('DD/MM/YYYY')
    else dob = '01/01/1999' // dummy placeholder

    // compose an email address - could be a duplicate but we only check at point of
    // creating the Cognito entry - which will scream if duplicate exists
    studentPart.email =
      `${student.forename}${student.surname}@${selectedSchool.schoolName}`.replace(/\s/g, '')
    studentPart.SwondeId = student.id // need to make unique list for upload
    studentPart.Smis_id = student.mis_id
    studentPart.firstName = student.forename
    studentPart.middleName = student.middle_names ? student.middle_names : ''
    studentPart.lastName = student.surname
    studentPart.yearCode = student.yearCode // like n or K or FY
    studentPart.gender = gender
    studentPart.dob = dob

    // now process the classrooms - may be none
    student.classes.data.forEach((classroom) => {
      //console.log('classroom', classroom)
      let classroomPart = {}
      classroomPart.CwondeId = classroom.id // need to make unique list for upload
      classroomPart.Cmis_id = classroom.mis_id // need to make unique list for upload
      classroomPart.classroomName = classroom.name
      // subject can be an object in the raw data, but we convert to a string in the filtered data
      // and both of these cases pass here - hence the test.
      // ALSO: "subject" is not part of the csv format, but used to get classroomLearningArea
      classroomPart.subject = ''
      if (classroom.subject) {
        if (typeof classroom.subject === 'string') {
          classroomPart.subject = classroom.subject
        } else {
          if (classroom.subject.data && classroom.subject.data.name) {
            classroomPart.subject = classroom.subject.data.name
          }
        }
      }
      classroomPart.classroomId = classroom.id

      // now process the teacher(s) - may be none, 1, multiple teachers per classroom
      // First make dummy columns for the teachers (up to 5 teachers)
      // If we dont make these dummy headers DevExtreme will only display the number of teachers in the first record!
      for (let n = 0; n < 5; n++) {
        let wondeId = `T${n + 1} WondeId`
        let fnameKey = `teacher${n + 1} FirstName`
        let lnameKey = `teacher${n + 1} LastName`
        let emailKey = `teacher${n + 1} email`
        let mis_id = `T${n + 1} mis_id`
        classroomPart[wondeId] = '-'
        classroomPart[fnameKey] = '-'
        classroomPart[lnameKey] = '-'
        classroomPart[emailKey] = '-'
        classroomPart[mis_id] = '-'
      }
      // now populate teacher columns
      classroom.employees.data.forEach((teacher, index) => {
        // Note: Keys generated dynamically using the array notation[]
        let fnameKey = `teacher${index + 1} FirstName`
        let lnameKey = `teacher${index + 1} LastName`
        let emailKey = `teacher${index + 1} email`
        let wondeId = `T${index + 1} WondeId`
        let mis_id = `T${index + 1} mis_id`
        classroomPart[fnameKey] = teacher.forename
        classroomPart[lnameKey] = teacher.surname
        classroomPart[emailKey] = teacher.email ? teacher.email : 'no email found'
        classroomPart[wondeId] = teacher.id
        classroomPart[mis_id] = teacher.mis_id
      })
      studentClassroomsTmp.push({
        ...studentPart,
        ...classroomPart,
        numericYearLevel: getNumericYearLevel(studentPart.yearCode),
      })
    })
  })
  let studentClassroomsTmpSorted = _.sortBy(studentClassroomsTmp, [
    'numericYearLevel',
    'wondeStudentId',
  ])

  setResultStateVariable(studentClassroomsTmpSorted) // for display in "upload Format" tab
  return studentClassroomsTmpSorted // The returned data is just for later console.log
} // end of formatStudentClassrooms()

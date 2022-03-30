import dayjs from 'dayjs'
import _ from 'lodash'
import { makeYearCode } from '../CommonHelpers/makeYearCode'
import { getGender } from '../CommonHelpers/getGender'

const UNKNOWN = 'unknown'

// This displays data in the same format (csv like) as we would use in the manual uploader
// was an afterthought - so overall processing looks convoluted
// wondeStudents, wondeTeachers are both raw data as read from Wonde
export function formatStudentClassrooms(
  wondeStudents,
  wondeTeachers,
  selectedSchool,
  setStudentClassrooms,
) {
  console.log('Wonde Student[0]', wondeStudents[0])
  console.log('wondeTeachers[0]', wondeTeachers[0])

  let studentClassroomsTmp = []
  wondeStudents.forEach((student) => {
    let studentPart = {}
    // first put defaults for gender and dob if they are missing ( often they are)
    // Converting the original wonde values set for gender,dob to the ones required by the CSV upload format
    let gender = getGender(student.gender)

    let dob
    if (dayjs(student.date_of_birth.date).isValid())
      dob = dayjs(student.date_of_birth.date).format('DD/MM/YYYY')
    else dob = '01/01/1999' // dummy placeholder

    // Try to construct a yearCode from all the possibilities entered by schools
    let yearCode = makeYearCode(student)
    if (yearCode === UNKNOWN) {
      yearCode = 'U-' + student.year.data.code
      console.log(
        `Unknown year code for student: ${student.forename} ${student.surname} ${student.date_of_birth.date} has ${yearCode} for yearLevel `,
      )
    }

    // compose an email address - could be duplicate but we only check at point of
    // creating the Cognito entry - which will scream if duplicate exists
    studentPart.email =
      `${student.forename}${student.surname}@${selectedSchool.schoolName}`.replace(/\s/g, '')
    studentPart.SwondeId = student.id // need to make unique list for upload
    studentPart.Smis_id = student.mis_id
    studentPart.firstName = student.forename
    studentPart.middleName = student.middle_names ? student.middle_names : ''
    studentPart.lastName = student.surname
    studentPart.yearCode = yearCode // like n or K or FY
    studentPart.gender = gender
    studentPart.dob = dob

    //
    // now process the classrooms - could has no classroom assigned
    student.classes.data.forEach((classroom) => {
      let classroomPart = {}
      classroomPart.CwondeId = classroom.id // need to make unique list for upload
      classroomPart.Cmis_id = classroom.mis_id // need to make unique list for upload
      classroomPart.classroomName = classroom.name
      // subject can be an object in the raw data, but we convert to a string in the filtered data
      // and both of these cases pass here - hence the test.
      classroomPart.subject = typeof classroom.subject === 'string' ? classroom.subject : ''
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
        // find the email address from wondeTeachersTemp
        let email = 'placeholder'
        let teacherID = teacher.id
        let teacherRecord = wondeTeachers.find((teacher) => teacher.id === teacherID)
        if (teacherRecord) {
          email = teacherRecord.contact_details.data.emails.email
        }
        // Note: Keys generated dynamically using the array notation[]
        let fnameKey = `teacher${index + 1} FirstName`
        let lnameKey = `teacher${index + 1} LastName`
        let emailKey = `teacher${index + 1} email`
        let wondeId = `T${index + 1} WondeId`
        let mis_id = `T${index + 1} mis_id`
        classroomPart[fnameKey] = teacher.forename
        classroomPart[lnameKey] = teacher.surname
        classroomPart[emailKey] = email
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
  console.log('CSV formatted data', studentClassroomsTmpSorted[0])
  setStudentClassrooms(studentClassroomsTmpSorted) // for display in "upload Format" tab
} // end of formatStudentClassrooms()

function getNumericYearLevel(yearCode) {
  switch (yearCode) {
    case 'K':
      return -1
    case 'FY':
    case 'R':
      return 0
    default:
      return parseInt(yearCode)
  }
}

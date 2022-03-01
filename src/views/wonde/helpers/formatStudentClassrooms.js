import dayjs from 'dayjs'
import _ from 'lodash'
import { getYearCodeForYear0 } from './getYearCodeForYear0'
const UNKNOWN = 'unknown'

// This displays data in the same format (csv like) as we would use in the manual uploader
// was an afterthought - so overall processing looks convoluted
// wondeStudents, wondeTeachers are both raw data as read from Wonde
export function formatStudentClassrooms(
  wondeStudents,
  wondeTeachers,
  selectedSchool,
  setStudentClassrooms,
  setFilteredStudentClassrooms,
  yearFilters,
  kinterDayClasses,
  kinterDayClassName,
) {
  console.log('Wonde Students', wondeStudents)
  console.log('wondeTeachers', wondeTeachers)
  console.log('yearFilters', yearFilters)

  let studentClassroomsTmp = []
  wondeStudents.forEach((student, index) => {
    let studentPart = {}
    // first put defaults for gender and dob if they are missing ( often they are)
    // Converting the original wonde values set for gender,dob to the ones required by the CSV upload format
    let gender = 'X'
    if (student.gender && student.gender !== 'X')
      gender = student.gender.charAt(0).toUpperCase() + student.gender.slice(1).toLowerCase()

    let dob = 'XXXX-XX-XX'
    if (dayjs(student.date_of_birth.date).isValid())
      dob = dayjs(student.date_of_birth.date).format('DD/MM/YYYY')

    // look for N codes meaning Nursery and output edC code "K"
    // look for R codes meaning Reception and output EdC code "FY"
    // If non of above try to extract the year level as a number

    let yearCode = UNKNOWN // a dummy value
    // check for known FY or K strings
    switch (student.year.data.code) {
      case 'Year R': // St Andrew and St Francis CofE Primary School, Our Lady Star of the Sea Catholic Primary School,English Martyrs' Catholic Primary School
      case 'R': // St Monica's Catholic Primary School, St Mark's Primary School
      case 'Girls Reception': // Claires Court Schools
      case 'Boys Reception': // Claires Court Schools
        yearCode = getYearCodeForYear0()
        break
      case 'N1': // St Monica's Catholic Primary School
      case 'N2': // St Mark's Primary School
      case 'Nursery': // St Andrew and St Francis CofE Primary School
      case 'Year N': // Parkside Community Primary School
      case 'Year N1': // Parkside Community Primary School,  Our Lady Star of the Sea Catholic Primary School
      case 'Year N2': // St Andrew and St Francis CofE Primary School
        yearCode = 'K'
        break
      default: {
        break
      }
    }

    // if we did not find an FY or K code then look for a numeric year level
    if (yearCode === UNKNOWN) {
      let numStr = student.year.data.code.match(/\d+/) // match returns an array
      if (numStr) {
        let num = parseInt(numStr[0])
        if (num > 0 && num <= 12) {
          //yearCode = `Y${num.toString()}`
          yearCode = num.toString() // "5" not "Y5" is expected by the csv
        } else {
          console.log(`Year code out of range 1-12, found ${numStr}`)
        }
      }
    }

    // the year code is unrecognisable
    if (yearCode === UNKNOWN) {
      yearCode = 'U-' + student.year.data.code
      console.log(
        `Unknown year code for student: ${student.forename}${student.surname} ${yearCode}`,
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

    // now process the classrooms - could has no classroom assigned
    student.classes.data.forEach((classroom) => {
      let classroomPart = {}
      classroomPart.CwondeId = classroom.id // need to make unique list for upload
      classroomPart.Cmis_id = classroom.mis_id // need to make unique list for upload
      classroomPart.classroomName = classroom.name
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
        let teacherRec = wondeTeachers.find((teacher) => teacher.id === teacherID)
        if (teacherRec) {
          email = teacherRec.contact_details.data.emails.email
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
      studentClassroomsTmp.push({ ...studentPart, ...classroomPart })
    })
  })
  let studentClassroomsTmpSorted = _.sortBy(studentClassroomsTmp, ['yearCode', 'wondeStudentId'])
  setStudentClassrooms(studentClassroomsTmpSorted) // for display in "upload Format" tab
  setFilteredStudentClassrooms(
    applyFilters(studentClassroomsTmpSorted, yearFilters, kinterDayClasses, kinterDayClassName),
  ) // for dsplay in "upload Format filtered" tab
} // end of formatStudentClassrooms()

// This filters the studentclassroom list to remove unwanted records
// Filter Rules:
//    Only include years 1-12,FY and K by default or otherwise the contents of
//    Add year level to the start of Classroom names if not already there
//    Remove Mon-AM, Mon-PM and replace with "Mon-Fri" for FY students
function applyFilters(listToFilter, yearFilters, kinterDayClasses, kinterDayClassName) {
  // when we reach here the year levels are all good or UNKNOWN
  // The list is filtered by wondeStudentId
  let filteredList = []

  // use this variable to eliminate duplicate classes for Kindy students
  let currentStudentWondeId = null

  listToFilter.forEach((student) => {
    // must be one of the selected years
    if (yearFilters.find((yearCode) => yearCode === student.yearCode)) {
      // remove duplicate Kindy classes based on Mon-AM ect
      // for now we remove all duplicate classrooms
      if (student.yearCode === 'K') {
        if (
          !currentStudentWondeId ||
          (currentStudentWondeId && currentStudentWondeId !== student.SwondeId)
        ) {
          currentStudentWondeId = student.SwondeId
          student.classroomName = kinterDayClassName
          filteredList.push(student)
        }
      } else {
        filteredList.push(student)
      }
    }
  })

  return filteredList
} // end function applyFilters()

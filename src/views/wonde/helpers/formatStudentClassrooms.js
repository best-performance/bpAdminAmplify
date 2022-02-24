import dayjs from 'dayjs'

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
) {
  console.log('Wonde Students', wondeStudents)
  console.log('wondeTeachers', wondeTeachers)

  let studentClassroomsTmp = []
  wondeStudents.forEach((student, index) => {
    let studentPart = {}
    // first put defaults for gender and dob if they are missing ( often they are)
    let gender = 'X'
    if (student.gender && student.gender !== 'X') gender = student.gender.charAt(0)
    let dob = 'XXXX-XX-XX'
    if (dayjs(student.date_of_birth.date).isValid())
      dob = dayjs(student.date_of_birth.date).format('DD/MM/YYYY')
    let yearCode

    try {
      let numStr = student.year.data.code.match(/\d+/) // match returns an array
      if (numStr) {
        let num = parseInt(numStr[0])
        if (num > 0 && num < 14) {
          yearCode = `Y${num.toString()}`
        } else {
          if (num === 0) {
            yearCode = 'FY' // for Foundation Year
          } else {
            //console.log('num value in year code', num)
            yearCode = UNKNOWN // and filter them out later
          }
        }
      } else {
        // We can test for known strings here (when we know them!)
        console.log('strange value in year code', student.year.data.code)
        yearCode = UNKNOWN // and filter them out later
      }
    } catch (err) {
      console.log('problem with student year', student.forename, student.surname, index)
    }
    // we have to try to get a good year level

    // compose an email address - could be duplicate but we only check at point of
    // creating the Cognito entry - which will scream if duplicate exists
    studentPart.email =
      `${student.forename}${student.surname}@${selectedSchool.schoolName}`.replace(/\s/g, '')
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
      classroomPart.mis_id = classroom.mis_id // need to make unique list for upload
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
      item.yearCode !== UNKNOWN &&
      (item.classroomName === 'Mathematics' ||
        item.classroomName === 'English' ||
        item.classroomName === 'Science')
    )
  })

  return filteredList
} // end function applyFilters()

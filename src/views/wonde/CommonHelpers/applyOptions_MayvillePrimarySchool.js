import _ from 'lodash'
// Options for applyOptions_MayvillePrimarySchool
// This filters the studentclassroom list to remove unwanted records
// Filter Rules:
//    Include all classrooms from Reception to year 6
//    Compress the Kindy to one class (to be verified)
//    Include all year Levels
export function applyOptions_MayvillePrimarySchool(
  wondeStudents,
  yearOptions,
  kinterDayClasses,
  kinterDayClassName, // use this classroom name style if compressing classes
  coreSubjectOption,
) {
  console.log('in applyOptions_MayvillePrimarySchool()')
  console.log('Wonde list of changes to Filter[0]', wondeStudents[0])
  console.log('coreSubjectOption', coreSubjectOption)

  // Clone since we are doing updates
  let wondeStudentsCloned = _.cloneDeep(wondeStudents)

  // If a school uptake these parameters are set by the UI
  // After that the chosen options are remembered here (ugly)
  if (yearOptions === null) {
    yearOptions = {
      Y0: true,
      Y1: true,
      Y2: true,
      Y3: true,
      Y4: true,
      Y5: true,
      Y6: true,
      Y7: true,
      Y8: true,
      Y9: true,
      Y10: true,
      Y11: true,
      Y12: true,
      Y13: true,
      K: true,
      R: true,
      FY: true,
    }
  }
  if (kinterDayClasses === null) {
    // not used in Parkside Grammar
    kinterDayClasses = false
  }
  if (kinterDayClassName === null) {
    // not used in Parkside Grammar
    kinterDayClasses = ''
  }
  if (coreSubjectOption === null) {
    // Taking all classes - there is only one class per student
    coreSubjectOption = false
  }

  let filteredList = []

  // The data to be filtered is the raw student->classroom->teacher data read from Wonde

  wondeStudentsCloned.forEach((student) => {
    if (student.surname === 'Snell' && student.forename === 'Katie')
      console.log('Katie Snell.......................', student)
    // Each student has a list of classrooms, that we have to filter
    // Must be one of the selected years

    // use this variable to eliminate duplicate classes for Kindy students
    let currentStudentWondeId = null
    let filteredClasses = []
    // Put a 'Y' in front of numeric keys
    let yearCode = student.yearCode
    let studentYear = parseInt(yearCode)
    if (!isNaN(studentYear)) yearCode = `Y${yearCode}`
    if (yearOptions[yearCode]) {
      student.classes.data.forEach((classroom) => {
        // remove duplicate Kindy classes based on Mon-AM etc
        // for now we remove all duplicate classrooms
        if (kinterDayClasses && yearCode === 'K') {
          console.log('kindy student', student, currentStudentWondeId, student.id)
          if (
            !currentStudentWondeId ||
            (currentStudentWondeId && currentStudentWondeId !== student.id)
          ) {
            // Creating a new object to avoid changing the original classroom value of the student
            currentStudentWondeId = student.id
            filteredClasses.push({
              ...classroom,
              name: kinterDayClassName ? kinterDayClassName : 'K-Kindy',
              subject: 'Kindy',
            })
          }
        } else {
          if (coreSubjectOption) {
            if (classroom.subject) {
              // Kings School Ely has Science but also Physics, chemistry, Biology
              // Kings School Ely has English but also English Literature
              let subjectName = classroom.subject.data.name
              if (subjectName.includes('Mathematics')) {
                classroom.subject = 'Mathematics'
                filteredClasses.push(classroom)
              } else if (subjectName.includes('English')) {
                classroom.subject = 'English'
                filteredClasses.push(classroom)
              } else if (subjectName.includes('Science')) {
                classroom.subject = 'Science'
                filteredClasses.push(classroom)
              } else if (subjectName.includes('Biology')) {
                classroom.subject = 'Sc-Biology'
                filteredClasses.push(classroom)
              } else if (subjectName.includes('Chemistry')) {
                classroom.subject = 'Sc-Chemistry'
                filteredClasses.push(classroom)
              } else if (subjectName.includes('Physics')) {
                classroom.subject = 'Sc-Physics'
                filteredClasses.push(classroom)
              }
            }
          } else {
            // Accept all classrooms (this school has only one classroom per student after Kindy)
            filteredClasses.push(classroom)
          }
        }
      })
      if (student.classes.data.length > 0) {
        // a student must have at least one class
        student.classes.data = filteredClasses
        filteredList.push(student)
      } else {
        console.log(`No core classes - student filtered out`, student)
      }
    } else {
      console.log(`yearcode ${student.yearCode} bad - student filtered out`, student)
    }
  })
  console.log('filtered list[0]', filteredList[0])
  return filteredList
} // end function applyOptions_MayvillePrimarySchool()

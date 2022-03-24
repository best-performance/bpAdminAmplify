// This filters the studentclassroom list to remove unwanted records
// Filter Rules:
//    Only include years 1-12,FY and K by default or otherwise the contents of
//    Add year level to the start of Classroom names if not already there
//    Remove Mon-AM, Mon-PM and replace with "Mon-Fri" for FY students
export function applyOptions(
  listToFilter,
  yearOptions,
  kinterDayClasses,
  kinterDayClassName,
  coreSubjectOption,
) {
  // when we reach here the year levels are all good or UNKNOWN ((Remove later))
  // The list is filtered by wondeStudentId
  console.log('listToFilter', listToFilter)
  console.log('coreSubjectOption', coreSubjectOption)
  let filteredList = []

  // use this variable to eliminate duplicate classes for Kindy students
  let currentStudentWondeId = null
  listToFilter.forEach((student) => {
    let yearCode = student.yearCode
    let studentYear = parseInt(student.yearCode)
    // have to put a Y in front of numeric keys
    if (!isNaN(studentYear)) yearCode = `Y${student.yearCode}`
    // must be one of the selected years
    if (yearOptions[yearCode]) {
      // remove duplicate Kindy classes based on Mon-AM etc
      // for now we remove all duplicate classrooms
      if (
        (kinterDayClasses && ['K', 'FY', 'R'].lastIndexOf(student.student.yearCode) > -1) ||
        (studentYear >= 1 && studentYear <= 6)
      ) {
        if (
          !currentStudentWondeId ||
          (currentStudentWondeId && currentStudentWondeId !== student.SwondeId)
        ) {
          // TODO - I think this subject check is specific to Claire's Court
          // and wont work for normal primary schools - confer with Diego
          if (['English', 'Mathematics'].lastIndexOf(student.subject) > -1) {
            currentStudentWondeId = student.SwondeId
            let classroomName = `${student.classroomName.charAt(0)} ${student['teacher1 LastName']}`
            // Creating a new object to avoid changing the original classroom value of the student
            filteredList.push({ ...student, classroomName, subject: 'PRIMARY' })
          }
        }
      }

      if (studentYear > 6 && studentYear <= 13) {
        if (coreSubjectOption) {
          if (student.classroomName.includes('Mathematics')) {
            // classroomName = 'Mathematics'
            filteredList.push(student)
          } else if (student.classroomName.includes('English')) {
            // classroomName = 'English'
            filteredList.push(student)
          } else if (student.classroomName.includes('Science')) {
            // classroomName = 'Science'
            filteredList.push(student)
          }
        }
      }
    }
  })
  console.log('filtered list', filteredList)
  return filteredList
} // end function applyFilters()

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
  // when we reach here the year levels are all good or UNKNOWN
  // The list is filtered by wondeStudentId
  console.log('listToFilter', listToFilter)
  console.log('coreSubjectOption', coreSubjectOption)
  let filteredList = []

  // use this variable to eliminate duplicate classes for Kindy students
  let currentStudentWondeId = null

  listToFilter.forEach((student) => {
    let yearCode = student.yearCode
    // have to put a Y in front of numeric keys
    if (!isNaN(parseInt(student.yearCode))) yearCode = `Y${student.yearCode}`
    // must be one of the selected years
    if (yearOptions[yearCode]) {
      // remove duplicate Kindy classes based on Mon-AM ect
      // for now we remove all duplicate classrooms
      if (kinterDayClasses && student.yearCode === 'K') {
        if (
          !currentStudentWondeId ||
          (currentStudentWondeId && currentStudentWondeId !== student.SwondeId)
        ) {
          currentStudentWondeId = student.SwondeId
          let classroomName = kinterDayClassName
          // Creating a new object to avoid changing the original classroom value of the student
          filteredList.push({ ...student, classroomName })
        }
      } else {
        // add the row if not Kintergarten
        if (coreSubjectOption) {
          let classroomName = ''
          if (student.classroomName.includes(' Te') || student.classroomName.includes('Techno')) {
            classroomName = 'Technology'
            filteredList.push({ ...student, classroomName })
          } else if (
            student.classroomName.includes(' Ma') ||
            student.classroomName.includes('Math')
          ) {
            classroomName = 'Mathematics'
            filteredList.push({ ...student, classroomName })
          } else if (
            student.classroomName.includes(' En') ||
            student.classroomName.includes('English')
          ) {
            classroomName = 'English'
            filteredList.push({ ...student, classroomName })
          } else if (
            student.classroomName.includes(' Sc') ||
            student.classroomName.includes('Science')
          ) {
            classroomName = 'Science'
            filteredList.push({ ...student, classroomName })
          }
        } else {
          filteredList.push(student)
        }
      }
    }
  })
  console.log('filtered list', filteredList)
  return filteredList
} // end function applyFilters()

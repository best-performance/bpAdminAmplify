// get the students from that have been updated since "aferDate"

import axios from 'axios'
import _ from 'lodash'
import { getToken, getURL } from '../CommonHelpers/featureToggles'
import { getYearCode } from '../CommonHelpers/getYearCode'

async function getChangedStudents(school, afterDate) {
  let studentsWithUpdates = [] // final output

  // executed for each student returned by Wonde
  function saveStudent(student) {
    if (student.id === 'B1379166035') console.log('-------student B1379166035', student) // 1 before
    if (student.id === 'B889709018') console.log('-------student B889709018', student)
    if (student.id === 'B1969204232') console.log('-------student B1969204232', student) // 1 after

    let studentToSave = _.cloneDeep(student)
    // Format the year code because its needed for filtering
    studentToSave.yearCode = getYearCode(studentToSave)
    // save the cloned,modified object
    studentsWithUpdates.push(studentToSave)
  }

  try {
    let URL = `${getURL()}/${
      school.wondeID
    }/students?updated_after=${afterDate}&include=classes.employees,classes.subject,year&per_page=200`
    let morePages = true
    let response
    while (morePages) {
      console.log(URL)
      response = await axios({
        method: 'get',
        url: URL,
        headers: {
          Authorization: getToken(),
        },
      })
      console.log('Raw response from Wonde - one page', response)
      response.data.data.forEach((student) => saveStudent(student))
      // check if all pages are read
      if (response.data.meta.pagination.next != null) {
        URL = response.data.meta.pagination.next
      } else {
        morePages = false
      }
    }
    console.log('reading finished.................')
    return studentsWithUpdates
  } catch (error) {
    console.log(error)
    return []
  }
} // end getChangedStudents()

export default getChangedStudents

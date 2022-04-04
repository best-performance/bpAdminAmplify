// get the students from that have been updated since "aferDate"

import axios from 'axios'
import dayjs from 'dayjs'
import { getToken, getURL } from '../CommonHelpers/featureToggles'
import { getYearCode } from '../CommonHelpers/getYearCode'

async function getChangedStudents(school, afterDate) {
  let studentsWithUpdates = [] // final output
  let responses = [] // array of response pages

  // executed for each response object returned from Wonde
  function processResponse(response) {
    //let dummyStudent = response.data.data[0]
    response.data.data.forEach((student) => processStudent(student))
  }

  // executed for each student returned by Wonde
  function processStudent(student) {
    if (student.id === 'B1379166035') console.log('-------student B1379166035', student) // 1 before
    if (student.id === 'B889709018') console.log('-------student B889709018', student)
    if (student.id === 'B1969204232') console.log('-------student B1969204232', student) // 1 after

    // Format the year code because its needed for filtering
    //let studentWithYearCode = { ...student }
    //studentWithYearCode.yearCode = getYearCode(studentWithYearCode)
    student.yearCode = getYearCode(student)
    if (student.id === 'B889709018') {
      console.log('-------studentWithYearCode B889709018', student)

      // studentsWithUpdates.push({ ...student })
    }
    // save the response data
    //students.push(studentWithYearCode)
    studentsWithUpdates.push(student)
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
      responses.push(response)
      // check if all pages are read
      if (response.data.meta.pagination.next != null) {
        URL = response.data.meta.pagination.next
      } else {
        morePages = false
      }
    }
    console.log('reading finished.................')
    responses.forEach((response) => processResponse(response))
    return studentsWithUpdates
  } catch (error) {
    console.log(error)
    return []
  }
}

async function getChangedStudents2(school, afterDate) {
  let students = []
  // Note: When Wonde is queried for changed students, it returns a so far undefined
  // list of classrooms - which can be relied on
  // Until Wonde rectify or advise a workaround, the method below is proposed.
  // 1) Read ALL students with classes attached.
  // 2) Remove students whose updated_after is after the reference date
  try {
    let URL = `${getURL()}/${
      school.wondeID
    }/students?include=classes.employees,classes.subject,year&per_page=200`
    let morePages = true
    let response
    while (morePages) {
      console.log(URL)
      response = await fetch(URL, {
        method: 'get',
        headers: {
          Authorization: getToken(),
        },
      })
      let responseBody = await response.text()
      let responseBodyParsed = JSON.parse(responseBody)
      console.log('response from Wonde', responseBodyParsed)
      // eslint-disable-next-line no-loop-func
      responseBodyParsed.data.forEach((student, index) => {
        if (student.id === 'B889709018') console.log('-------student B889709018', student)
        if (student.id === 'B1379166035') console.log('-------student B1379166035', student)
        if (student.id === 'B1969204232') console.log('-------student B1969204232', student)
        if (dayjs(student.updated_at.date).isAfter(dayjs(afterDate))) {
          // ...doing wonde's work
          // Format the year code because its needed for filtering
          let studentWithYearCode = { ...student }
          studentWithYearCode.yearCode = getYearCode(studentWithYearCode)
          if (student.id === 'B889709018') {
            console.log('-------studentWithYearCode B889709018', studentWithYearCode)
            students.push(studentWithYearCode)
          }
          // save the response data
        }
      })
      // check if all pages are read
      if (responseBodyParsed.meta.pagination.next != null) {
        URL = responseBodyParsed.meta.pagination.next
      } else {
        morePages = false
      }
    }
    return students
  } catch (error) {
    console.log(error)
    return []
  }
}

async function getChangedStudents1(school, afterDate) {
  // First 2 queries are TEST ONLY
  //let URL = `${getURL()}/${
  //  school.wondeID
  //}/students/B889709018/?include=classes.employees,classes.subject,year&per_page=200`
  //console.log(URL)
  //// was include=year,classes.employees&per_page=200
  //// now include=classes.employees,classes.subject,year&per_page=200
  //let response = await axios({
  //  method: 'get',
  //  url: URL,
  //  headers: {
  //    Authorization: getToken(),
  //  },
  //})
  //console.log('naked read of student B889709018 no data filter', response)
  //
  // URL = `${getURL()}/${
  //   school.wondeID
  // }/students/B889709018/?updated_after=${afterDate}&include=year,classes&per_page=200`
  // console.log(URL)

  //   response = await axios({
  //   method: 'get',
  //   url: URL,
  //   headers: {
  //     Authorization: getToken(),
  //   },
  // })

  // console.log('naked read of student B889709018 with date Filter', response)
  // End of TEST queries

  // let URL = `${getURL()}/${wondeSchoolID}/students?include=classes.employees,classes.subject,year&per_page=200`
  // was `${getURL()}/${school.wondeID}/students?updated_after=${afterDate}&include=year,classes&per_page=200`
  let students = []
  // Note: When Wonde is queried for changed students, it returns a so far undefined
  // list of classrooms - which can be relied on
  // Until Wonde rectify or advise a workaround, the method below is proposed.
  // 1) Read ALL students with classes attached.
  // 2) Remove students whose updated_after is after the reference date
  try {
    let URL = `${getURL()}/${
      school.wondeID
    }/students?include=classes.employees,classes.subject,year&per_page=200`
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
      console.log('response from Wonde', response)
      // eslint-disable-next-line no-loop-func
      response.data.data.forEach((student, index) => {
        if (student.id === 'B889709018') console.log('-------student B889709018', student)
        if (dayjs(student.updated_at.date).isAfter(dayjs(afterDate))) {
          // ...doing wonde's work
          // Format the year code because its needed for filtering
          let studentWithYearCode = { ...student }
          studentWithYearCode.yearCode = getYearCode(studentWithYearCode)
          students.push(studentWithYearCode) // save the response data
          if (student.id === 'B889709018')
            console.log('AU student B889709018 from wonde', studentWithYearCode)
          if (student.id === 'A1404817692')
            console.log('UK student A1404817692 from wonde', studentWithYearCode)
        }
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
    return []
  }

  return students
}

export default getChangedStudents

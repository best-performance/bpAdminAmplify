// get the students from that have been updated since "aferDate"
const axios = require('axios')
const { getToken, getURL } = require('../CommonHelpers/featureToggles')

async function getChangedStudents(school, afterDate) {
  // First 2 queries are TEST ONLY
  let URL = `${getURL()}/${school.wondeID}/students/B889709018/?include=year,classes&per_page=200`
  console.log(URL)

  let response = await axios({
    method: 'get',
    url: URL,
    headers: {
      Authorization: getToken(),
    },
  })
  console.log('naked read of student B889709018 no data filter', response)

  URL = `${getURL()}/${
    school.wondeID
  }/students/B889709018/?updated_after=${afterDate}&include=year,classes&per_page=200`
  console.log(URL)

  response = await axios({
    method: 'get',
    url: URL,
    headers: {
      Authorization: getToken(),
    },
  })

  console.log('naked read of student B889709018 with date Filter', response)
  // End of TEST queries
  // let URL = `${getURL()}/${wondeSchoolID}/students?include=classes.employees,classes.subject,year&per_page=200`
  // was `${getURL()}/${school.wondeID}/students?updated_after=${afterDate}&include=year,classes&per_page=200`
  let students = []
  try {
    let URL = `${getURL()}/${
      school.wondeID
    }/students?updated_after=${afterDate}&include=classes.employees,classes.subject,year&per_page=200`
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
        if (student.id === 'B889709018') console.log('student B889709018 from wonde', student)
        students.push(student)
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

const dayjs = require('dayjs')
const { API } = require('aws-amplify')
const { updateAWSCredentials } = require('../CommonHelpers/updateAWSCredentials')

// This query retrieves the classrooms for the passed student from ClassroomStudent table
// It also retrieves details of the classroom

const getStudentByWondeID = /* GraphQL */ `
  query GetStudentByWondeID($wondeID: String) {
    getStudentByWondeID(wondeID: $wondeID) {
      items {
        id
        classrooms {
          items {
            classroomID
            classroom {
              className
              wondeID
            }
          }
        }
      }
    }
  }
`

export default async function processStudentClassroom(student) {
  // get ready for AWS service calls
  updateAWSCredentials() // uses the Cognito Identify pool role

  let studentClasses = []
  // do a test Appsync call
  try {
    const response = await API.graphql({
      query: getStudentByWondeID,
      variables: { wondeID: student.id },
      authMode: 'AMAZON_COGNITO_USER_POOLS',
    })

    // check if the student is assigned to some classrooms
    if (response.data.getStudentByWondeID.items.length > 0) {
      const {
        data: {
          getStudentByWondeID: {
            items: [
              {
                classrooms: { items },
              },
            ],
          },
        },
      } = response
      console.log('classrooms in Dynamo for student', student.id, items)
    } else {
      console.log('Student has no classrooms', student.id, student.surname)
    }
  } catch (err) {
    console.log(err)
  }

  return []
} // end process studentClassroom

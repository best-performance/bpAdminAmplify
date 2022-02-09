import React, { useState, useContext } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardGroup,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CInputGroup,
  CRow,
} from '@coreui/react'
import { Auth } from 'aws-amplify'
import loggedInContext from 'src/loggedInContext'
import notify from 'devextreme/ui/notify'

const Login = () => {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [schoolName, setSchoolName] = useState('')

  const { loggedIn } = useContext(loggedInContext)

  // Test function to create a new user
  async function handleUserCreation() {
    let user = {}
    try {
      user = await Auth.signUp({
        username,
        password: `${username}P${new Date().getFullYear()}!`,
        attributes: {
          email,
          nickname,
          'custom:schoolName': schoolName, // custom attribute, not standard
        },
      })
      console.log(user)
      notify('👋 The user has been registered', 'success', 3000)
    } catch (error) {
      alert('The user was not created, please contact support')
      notify('The user was not created, please contact support', 'error', 3000)
    }
  }

  function handleResetForm() {
    setUsername('')
    setEmail('')
    setSchoolName('')
  }

  if (!loggedIn.username) {
    return (
      <CContainer>
        <CRow>Please login first</CRow>
      </CContainer>
    )
  }

  return (
    <div className="bg-light min-vh-100 d-flex flex-row">
      <CContainer>
        <CRow>
          <CCol style={{ height: '100px' }}></CCol>
        </CRow>
        <CRow className="justify-content-center">
          <CCol md={4}>
            <CCardGroup>
              <CCard className="p-4">
                <CCardBody>
                  <CForm>
                    <h5>Users Creation</h5>
                    <p className="text-medium-emphasis">Create a new user in the Admin App</p>
                    <CInputGroup className="mb-3">
                      <CFormInput
                        type="email"
                        id="exampleFormControlInput1"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          setUsername(
                            e.target.value.split('@')[0] ? e.target.value.split('@')[0] : '',
                          )
                        }}
                      />
                    </CInputGroup>
                    <CInputGroup className="mb-3">
                      <CFormInput placeholder="Username" disabled={true} value={username} />
                    </CInputGroup>
                    <CInputGroup className="mb-3">
                      <CFormInput
                        placeholder="Nickname"
                        value={nickname}
                        onChange={(e) => {
                          setNickname(e.target.value)
                        }}
                      />
                    </CInputGroup>
                    <CInputGroup className="mb-3">
                      <CFormInput
                        placeholder="School Name"
                        value={schoolName}
                        onChange={(e) => {
                          setSchoolName(e.target.value)
                        }}
                      />
                    </CInputGroup>
                    <CRow>
                      <CCol xs={6}>
                        <CButton color="primary" className="px-4" onClick={handleUserCreation}>
                          Create User
                        </CButton>
                      </CCol>
                      <CCol xs={6}>
                        <CButton color="primary" className="px-4" onClick={handleResetForm}>
                          Reset Form
                        </CButton>
                      </CCol>
                    </CRow>
                  </CForm>
                </CCardBody>
              </CCard>
            </CCardGroup>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Login

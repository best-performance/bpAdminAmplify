import React, { useState } from 'react'
import { CContainer, CCol, CRow } from '@coreui/react'
import axios from 'axios'
import Button from 'devextreme-react/button'

// const API_URL_DEFAULT = 'https://r5pic75kwf.execute-api.ap-southeast-2.amazonaws.com/prod/' // apigateway for lambdas
// pick the right API url for the deployed region FEATURE_TOGGLE
const URL = process.env.REACT_APP_ENDPOINT
// ? `${process.env.REACT_APP_ENDPOINT}test`
// : `${API_URL_DEFAULT}test`

function LandingPage() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [lambdaMessage, setLambdaMessage] = useState('')

  // invoked when verify location Button is pressed
  async function lambdaHandler() {
    console.log(process.env.REACT_APP_ENDPOINT)
    let response = await axios({
      method: 'get',
      url: `${URL}test`,
      params: { param01: 'this is a test param' },
    })
    setIsLoaded(true)
    setLambdaMessage(`${response.data}`)
  }

  // invoked when Login Button is pressed
  async function loginHandler() {
    console.log('attempting to log in')
  }

  return (
    <>
      <CContainer>
        <CRow>
          <img src="../assets/images/angular.jpg" className="img-fluid" alt=""></img>
          <h3 className="text-center">BPAdmin App</h3>
        </CRow>
        <CRow>
          <h6>This application is for exclusive use by Authorised Administrators for:</h6>
        </CRow>
        <CRow>
          <h6> - Uploading Wonde School data for new schools</h6>
        </CRow>
        <CRow>
          <h6> - Safely uploading school data into region specific locations for new schools</h6>
        </CRow>
        <CRow>
          <h6> - Uploading test results</h6>
        </CRow>
        <CRow>
          <h6> - Running standard administrative queries</h6>
        </CRow>
        <CRow>
          <CCol sm="auto">
            <Button onClick={lambdaHandler}>Verify location of storage (disc and tables)</Button>
          </CCol>
          <CCol sm="auto">
            <div style={{ marginTop: '10px' }}>
              {isLoaded === true ? (
                <>
                  <span style={{ fontWeight: 'bold' }}>Backend resources are in </span>
                  <span>{lambdaMessage}</span>
                </>
              ) : (
                ''
              )}
            </div>
          </CCol>
        </CRow>
        <CRow>
          <CCol sm="auto" style={{ marginTop: '10px' }}>
            <Button onClick={loginHandler}>Login</Button>
          </CCol>
        </CRow>
      </CContainer>
    </>
  )
}
export default LandingPage

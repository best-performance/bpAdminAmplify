import React, { useContext, useEffect } from 'react'
import { CCard, CContainer, CRow, CSpinner } from '@coreui/react'
import { Storage } from '@aws-amplify/storage'
import { useState } from 'react'
import loggedInContext from 'src/loggedInContext'
import Button from 'devextreme-react/button'
import notify from 'devextreme/ui/notify'
import DataGrid, { Column } from 'devextreme-react/data-grid'

import { updateAWSCredentials } from '../../../wonde/CommonHelpers/updateAWSCredentials'

const FileUploader = () => {
  const [selectedFile, setSelectedFile] = useState()
  const [isSelected, setIsSelected] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [schoolFiles, setSchoolFiles] = useState([])
  const { loggedIn } = useContext(loggedInContext)

  useEffect(() => {
    async function loadConfigure() {
      await updateAWSCredentials()
      await Storage.configure({
        bucket: process.env.REACT_APP_UPLOADS_BUCKET,
        region: 'eu-west-2', // there is only one bucket and its in the UK
        identityPoolId: `${process.env.REACT_APP_IDENTITY_POOL_ID}`,
      })
      await listCurrentfiles()
    }
    loadConfigure()
    return () => {
      setSelectedFile(null) // This worked for me
      setIsSelected(false)
      setIsUploadingFile(false)
      setSchoolFiles([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function listCurrentfiles() {
    await updateAWSCredentials()
    let listOfFolders = await Storage.list(`${loggedIn.schoolName}/`, { level: 'protected' })
    console.log('list of Folders XYZ', listOfFolders)
    setSchoolFiles(
      listOfFolders.filter((folder) => folder.key.split('/') && folder.key.split('/')[1]),
    )
  }

  const changeHandler = (event) => {
    setSelectedFile(event.target.files[0])
    setIsSelected(true)
  }

  const uploadFileToS3 = async () => {
    setIsUploadingFile(true)
    if (selectedFile && loggedIn.schoolName) {
      let extension = selectedFile.name.split('.').pop()
      if (['csv', 'xls', 'xlsx'].lastIndexOf(extension) > -1) {
        try {
          // Make the "schoolName/" directory - will return key if already exists
          await Storage.put(`${loggedIn.schoolName}/`, null, { level: 'protected' })
          // Save the file in the above directory
          await Storage.put(`${loggedIn.schoolName}/${selectedFile.name}`, selectedFile, {
            level: 'protected',
            contentType: selectedFile.type,
          })
          notify('???? The file has been uploaded', 'success', 3000)
          setIsUploadingFile(false)
        } catch (err) {
          notify('The file has not been uploaded, please contact the support team', 'error', 3000)
          console.log('error', err)
          setIsUploadingFile(false)
        }
      } else {
        notify('Only spreadsheets with the format CSV, XLS, XLSX are accepted', 'error', 3000)
      }
    } else if (!loggedIn.schoolName) {
      notify("You don't have a school assigned, please contact the admin", 'error', 5000)
    } else {
      notify('You have not selected any file to upload', 'error', 3000)
    }
    setIsUploadingFile(false)
    document.getElementById('fileInput').value = null
    setSelectedFile(null)
    setIsSelected(false)
    await listCurrentfiles()
  }

  return (
    <CContainer>
      <CRow>
        <CCard style={{ padding: '30px' }}>
          {/* <p className="school-selected"> */}
          <h4>School selected: {loggedIn.schoolName}</h4>
          {/* </p> */}
          <div>
            <input
              id="fileInput"
              type="file"
              name="file"
              onChange={changeHandler}
              accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            />
            {isSelected && selectedFile ? (
              <div style={{ padding: '15px' }}>
                <p>File name: {selectedFile.name}</p>
                <p>
                  Size:{' '}
                  {Math.round(((selectedFile.size * 0.000001) / 1 + Number.EPSILON) * 100) / 100} MB
                </p>
                <p>Last Modified Date: {selectedFile.lastModifiedDate.toLocaleDateString()}</p>
              </div>
            ) : (
              <h5 style={{ marginTop: '30px' }}>Select a file to show details</h5>
            )}
            <div>
              <Button
                id="uploadFileBtn"
                text="Upload file"
                type="success"
                useSubmitBehavior={false}
                onClick={uploadFileToS3}
                style={{ marginTop: '30px' }}
                disabled={!isSelected}
              />
            </div>
          </div>
        </CCard>
      </CRow>
      {isUploadingFile && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            zIndex: 9999,
            overflow: 'hidden',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
          }}
        >
          <CSpinner style={{ margin: 'auto' }}></CSpinner>
        </div>
      )}
      <CRow>
        <DataGrid dataSource={schoolFiles}>
          <Column
            dataField="key"
            caption="File Name"
            dataType="string"
            alignment="center"
            cellRender={(cellData) => {
              if (cellData && cellData.value) {
                return <>{cellData.value.split('/')[1]}</>
              }
              return <></>
            }}
          />
          <Column
            dataField="lastModified"
            caption="Last Modified"
            dataType="date"
            alignment="center"
            format={'dd/MM/yyyy'}
          />
          <Column
            dataField="size"
            caption="Size"
            dataType="string"
            alignment="center"
            cellRender={(cellData) => {
              if (cellData && cellData.value) {
                return (
                  <>
                    {Math.round(((cellData.value * 0.000001) / 1 + Number.EPSILON) * 100) / 100} MB
                  </>
                )
              }
              return <></>
            }}
          />
        </DataGrid>
      </CRow>
    </CContainer>
  )
}
export default FileUploader

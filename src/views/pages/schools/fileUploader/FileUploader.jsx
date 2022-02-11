import React from 'react'
import { CCard, CContainer, CRow, CAlert } from '@coreui/react'
import { useCallback } from 'react'
import { useState } from 'react'
import Storage from '@aws-amplify/storage'
import notify from 'devextreme/ui/notify'

const FileUploader = () => {
  const [selectedFile, setSelectedFile] = useState()
  const [isSelected, setIsSelected] = useState(false)
  const [data, setData] = useState('')

  const changeHandler = (event) => {
    setSelectedFile(event.target.files[0])
    setIsSelected(true)
    console.log(event.target.files[0])
  }

  const handleCallback = (childData) => {
    console.log(childData)
    setData(childData.Name)
  }

  const uploadFileToS3 = (file, body) => {
    Storage.configure({
      bucket: 'bpadmin-sandbox-au',
      region: 'ap-southeast-2',
      identityPoolId: `${process.env.REACT_APP_IDENTITY_POOL}`,
    })
    console.log('data', `${process.env.REACT_APP_IDENTITY_POOL}`)
    Storage.put(`bpadmin-sandbox-au/${selectedFile.name}`, selectedFile, {
      contentType: selectedFile.type,
    })
      .then((result) => {
        notify('👋 The file has been uploaded', 'success', 3000)
      })
      .catch((err) => {
        notify('The file has not been uploaded, please contact the support team', 'error', 3000)
        console.log('error', err)
      })
  }

  const onDrop = useCallback((acceptedFiles) => {
    acceptedFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onabort = () => console.log('file reading was aborted')
      reader.onerror = () => console.log('file reading has failed')
      reader.onload = () => {
        const binaryStr = reader.result
        console.log(binaryStr) // File Contents
        uploadFileToS3(file, binaryStr)
      }
      reader.readAsBinaryString(file)
    })
  }, [])

  return (
    <CContainer>
      <CRow>
        <CCard>
          <p className="school-selected">
            <b>School selected: {data}</b>
          </p>
          <div>
            <input type="file" name="file" onChange={changeHandler} />
            {isSelected ? (
              <div>
                <p>Filename: {selectedFile.name}</p>
                <p>Filetype: {selectedFile.type}</p>
                <p>Size in bytes: {selectedFile.size}</p>
                <p>lastModifiedDate: {selectedFile.lastModifiedDate.toLocaleDateString()}</p>
              </div>
            ) : (
              <p>Select a file to show details</p>
            )}
            <div>
              <button onClick={uploadFileToS3}>Submit</button>
            </div>
          </div>
        </CCard>
      </CRow>
    </CContainer>
  )
}
export default FileUploader

// Al cargar la ventana, se ejecutan las funciones gapiLoaded y gisLoaded, 
// se verifica si hay un token de acceso almacenado y se restaura la sesión si es así.
window.onload = () => {
    gapiLoaded();
    gisLoaded()

    const storedAccessToken = localStorage.getItem('access_token');
    if (storedAccessToken) {
        // Restaura el token almacenado para mantener la sesión
        gapi.auth.setToken({ access_token: storedAccessToken });
        signinButton.style.display = 'none';
        signoutButton.style.display = 'block';
        checkFolder();
    }
}

// Configuración de las claves y valores necesarios para interactuar con la API de Google Drive
let CLIENT_ID = '';
let API_KEY = '';
let DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
let SCOPES = 'https://www.googleapis.com/auth/drive';
let signinButton = document.getElementsByClassName('signin')[0];
let signoutButton = document.getElementsByClassName('signout')[0];
let dragDiv = document.getElementById('drag-box');
let tokenClient;
let gapiInited = false;
let gisInited = false;

// Función que se ejecuta cuando se carga la API de Google Client Library
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

// Inicializa el cliente de la API de Google
async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: DISCOVERY_DOCS,
    });
    gapiInited = true;
    maybeEnableButtons();
}

// Inicializa el cliente de Google Identity Services
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: ''
    });
    gisInited = true;
    maybeEnableButtons();
}

// Activa los botones si ambas API (Google Client y Google Identity Services) están inicializadas
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        signinButton.style.display = 'block'
    }
}

// Manejador de clic en el botón de inicio de sesión
signinButton.onclick = () => handleAuthClick()
function handleAuthClick() {
    // Configura el callback para manejar la respuesta de Google Identity Services
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }

        localStorage.setItem('access_token', resp.access_token);

        signinButton.style.display = 'none'
        signoutButton.style.display = 'block'
        checkFolder()
    };

    // Solicita un token de acceso, solicitando el consentimiento si es necesario
    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

// Manejador de clic en el botón de cierre de sesión
signoutButton.onclick = () => handleSignoutClick()
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        signinButton.style.display = 'block'
        signoutButton.style.display = 'none'
    }
}

// Verifica la existencia de la carpeta "Transcripciones-Textos" en Google Drive
function checkFolder() {
    gapi.client.drive.files.list({
        'q': 'name = "Transcripciones-Textos"',
    }).then(function (response) {
        let files = response.result.files;
        if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                let file = files[i];
                localStorage.setItem('parent_folder', file.id);
                console.log('Folder Available');
                // Obtiene la lista de archivos si la carpeta está disponible
                showList();
            }
        } else {
            // Si la carpeta no está disponible, la crea
            createFolder();
        }
    })
}

// Función para cargar un archivo de texto en Google Drive
function upload() {
    // Obtiene el contenido del área de texto
    let text = document.querySelector('textarea');
    if (text.value != "") {
        const blob = new Blob([text.value], { type: 'plain/text' });
        // Obtiene el ID de la carpeta principal desde el almacenamiento local
        const parentFolder = localStorage.getItem('parent_folder');
        let twoWords = text.value.split(' ')[0] + '-' + text.value.split(' ')[1];
        // Configura los metadatos del archivo
        let metadata = {
            // Obtiene las dos primeras palabras del texto de entrada y las establece como nombre de archivo
            name: twoWords + '-' + String(Math.random() * 10000).split('.')[0] + '.txt',
            mimeType: 'plain/text',
            parents: [parentFolder]
        };
        let formData = new FormData();
        formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append("file", blob);

        // Realiza la solicitud de carga del archivo a Google Drive
        fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
            method: 'POST',
            headers: new Headers({ "Authorization": "Bearer " + gapi.auth.getToken().access_token }),
            body: formData
        }).then(function (response) {
            return response.json();
        }).then(function (value) {
            console.log(value);
            // Actualiza la lista al cargar el archivo
            showList();
        });
    }
}

// Función para crear la carpeta "Transcripciones-Textos" en Google Drive
function createFolder() {
    let access_token = gapi.auth.getToken().access_token;
    let request = gapi.client.request({
        'path': 'drive/v2/files',
        'method': 'POST',
        'headers': {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + access_token,
        },
        'body': {
            'title': 'Transcripciones-Textos',
            'mimeType': 'application/vnd.google-apps.folder'
        }
    });
    request.execute(function (response) {
        localStorage.setItem('parent_folder', response.id);
    })
}

let expandContainer = document.querySelector('.expand-container');
let expandContainerUl = document.querySelector('.expand-container ul');
let listcontainer = document.querySelector('.list ul');
// Función para mostrar u ocultar las opciones
function expand(v) {
    let click_position = v.getBoundingClientRect();
    let expandContainer = document.querySelector('.expand-container');
    let expandContainerUl = document.querySelector('.expand-container ul');
    let listContainer = document.querySelector('.list ul');

    if (expandContainer.style.display === 'block' && expandContainerUl.getAttribute('data-id') === v.parentElement.getAttribute('data-id')) {
        // Ocultar el contenedor si ya está visible y se hace clic en el mismo elemento de la lista
        expandContainer.style.display = 'none';
        expandContainerUl.setAttribute('data-id', '');
        expandContainerUl.setAttribute('data-name', '');
    } else {
        // Mostrar el contenedor y colocarlo al lado del elemento de la lista
        expandContainer.style.display = 'block';
        expandContainer.style.left = (click_position.left + window.scrollX + listContainer.offsetWidth) + 'px';
        expandContainer.style.top = (click_position.top + window.scrollY) + 'px';

        // Obtener datos de nombre e id y almacenarlos en las opciones
        expandContainerUl.setAttribute('data-id', v.parentElement.getAttribute('data-id'));
        expandContainerUl.setAttribute('data-name', v.parentElement.getAttribute('data-name'));
    }
    dragDiv.style.display = 'none';
}

// Función para mostrar la lista de archivos
function showList() {
    gapi.client.drive.files.list({
        // Obtener el ID de la carpeta principal desde el almacenamiento local
        'q': `parents in "${localStorage.getItem('parent_folder')}"`
    }).then(function (response) {
        let files = response.result.files;
        if (files && files.length > 0) {
            listcontainer.innerHTML = '';
            for (let i = 0; i < files.length; i++) {
                listcontainer.innerHTML += `
                
                <li data-id="${files[i].id}" data-name="${files[i].name}">
                <p onclick="expand(this)" class="nombre-texto">${files[i].name}</p>
                </li>
                
                `;
            }
        } else {
            listcontainer.innerHTML = '<div style="text-align: center;">No Files</div>'
        }
    })
}

// Función para leer, editar o descargar un archivo
function readEditDownload(v, condition) {
    let id = v.parentElement.getAttribute('data-id');
    let name = v.parentElement.getAttribute('data-name');
    v.innerHTML = '...';
    gapi.client.drive.files.get({
        fileId: id,
        alt: 'media'
    }).then(function (res) {
        expandContainer.style.display = 'none';
        expandContainerUl.setAttribute('data-id', '');
        expandContainerUl.setAttribute('data-name', '');
        if (condition == 'read') {
            v.innerHTML = 'Read';
            document.querySelector('textarea').value = res.body;
            document.documentElement.scrollTop = 0;
            console.log('Read Now')
        } else if (condition == 'edit') {
            v.innerHTML = 'Edit';
            document.querySelector('textarea').value = res.body;
            document.documentElement.scrollTop = 0;
            let updateBtn = document.getElementsByClassName('upload')[0];
            updateBtn.innerHTML = 'Update';
            // Se creará la función de actualización más adelante
            updateBtn.setAttribute('onClick', 'update()');
            document.querySelector('textarea').setAttribute('data-update-id', id);
            console.log('File ready for update');
        } else {
            v.innerHTML = 'Download';
            let blob = new Blob([res.body], { type: 'plain/text' });
            let a = document.createElement('a');
            a.href = window.URL.createObjectURL(blob);
            a.download = name;
            a.click();
        }
    })
}

// Función para actualizar un archivo
function update() {
    let updateId = document.querySelector('textarea').getAttribute('data-update-id');
    let url = 'https://www.googleapis.com/upload/drive/v3/files/' + updateId + '?uploadType=media';
    fetch(url, {
        method: 'PATCH',
        headers: new Headers({
            Authorization: 'Bearer ' + gapi.auth.getToken().access_token,
            'Content-type': 'plain/text'
        }),
        body: document.querySelector('textarea').value
    }).then(value => {
        console.log('File updated successfully');
        document.querySelector('textarea').setAttribute('data-update-id', '');
        let updateBtn = document.getElementsByClassName('upload')[0];
        updateBtn.innerHTML = 'Backup';
        updateBtn.setAttribute('onClick', 'uploaded()');
    }).catch(err => console.error(err))
}

// Función para eliminar un archivo
function deleteFile(v) {
    let id = v.parentElement.getAttribute('data-id');
    v.innerHTML = '...';
    let request = gapi.client.drive.files.delete({
        'fileId': id
    });
    request.execute(function (res) {
        console.log('File Deleted');
        v.innerHTML = 'Delete';
        expandContainer.style.display = 'none';
        expandContainerUl.setAttribute('data-id', '');
        expandContainerUl.setAttribute('data-name', '');
        // Después de eliminar, actualizar la lista
        showList();
    })
}

// Función para manejar la selección de archivos
function handleFileSelect(event) {
    const fileInput = event.target;
    const audioPreview = document.getElementById('audioPreview');
    const audioContainer = document.getElementById('audioContainer');

    if (fileInput.files.length > 0) {
        const audioFile = fileInput.files[0];
        const objectURL = URL.createObjectURL(audioFile);

        // Establecer la URL del objeto como fuente para el reproductor de audio
        audioPreview.src = objectURL;

        // Mostrar el contenedor de audio si hay un archivo seleccionado        
        audioContainer.style.display = 'flex'
    } else {
        // Limpiar la fuente y ocultar el contenedor si no hay archivo seleccionado
        audioPreview.src = '';
        audioContainer.style.display = 'none';
    }
}
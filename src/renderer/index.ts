import { ipcRenderer } from 'electron';
import './App';
import './css/index.css';

ipcRenderer.send('start');

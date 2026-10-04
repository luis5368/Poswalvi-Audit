import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

const getToken = () => {
  return localStorage.getItem('token');
};

const authHeaders = () => {
  return {
    headers: {
      Authorization: `Bearer ${getToken()}`
    }
  };
};

export const obtenerResumenAuditoria = async () => {
  const response = await axios.get(
    `${API_URL}/auditoria/dashboard/resumen`,
    authHeaders()
  );

  return response.data;
};

export const obtenerHallazgos = async () => {
  const response = await axios.get(
    `${API_URL}/auditoria/hallazgos`,
    authHeaders()
  );

  return response.data;
};

export const ejecutarMotorAuditoria = async () => {
  const response = await axios.post(
    `${API_URL}/auditoria/ejecutar/todas`,
    {},
    authHeaders()
  );

  return response.data;
};
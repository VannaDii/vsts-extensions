import { AxiosResponse, AxiosRequestConfig } from 'axios';

const responses: any[] = [];
const original = require('axios');

export function pushResponse(response: any) {
  responses.push(response);
}

function nextResponse(): any {
  return responses.shift();
}

original.post = <T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R> => {
  return Promise.resolve(nextResponse());
};

export default original;

import { AxiosResponse, AxiosRequestConfig } from 'axios';

const responses: { [key: string]: any[] } = {};
const original = require('axios');

export function pushResponse(response: any, url: string) {
  responses[url] = responses[url] || [];
  responses[url].push(response);
}

function nextResponse(url: string): any {
  return responses[url].shift();
}

original.post = <T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R> => {
  return Promise.resolve(nextResponse(url));
};

export default original;

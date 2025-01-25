import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LetterTracingService {

  private apiUrl = 'https://lisaaniapi.khabirak.pro/api/word'; // API endpoint

  constructor(private http: HttpClient) {}

  getWordPath(word: string) {
    return this.http.post(this.apiUrl, { word });
  }
}

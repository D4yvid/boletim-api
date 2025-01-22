import { JSDOM } from "jsdom";
import { Ok, Err, unwrap, Result } from "../util/error";

export type BoletimInformation = {
  course: string;
  grade: string;
  academicYear: string;
  birthDate: string;
  city: string;
  class: string;
  name: string;
  school: string;
  shift: string;
  state: string;
};

export type BoletimGrade = {
  subject?: string;
  grades: {
    1?: number;
    2?: number;
    3?: number;
    4?: number;
  };
  annualGradeAverage?: number;
  absences?: number;
  annualFrequence?: number;
  finalResult?: "APV" | "RPV" | "RPF";
};

export type Boletim = {
  information: BoletimInformation;
  grades: BoletimGrade[];
};

export type BoletimFetchRequest = {
  studentName: string;
  motherName: string;
  birthDate: string;
  year: number;
};

export type BoletimFetchResponse = {
  actionUrl: string;
  sessionId: string;
};

export type BoletimFetchDataRequest = {
  boletimUrl: string;
  sessionId: string;
};

const BASE_SEDUC_URL = "https://www.seduc.pa.gov.br/portal/boletim_online/";

import {
  ERROR_BIRTH_DATE_NOT_PROVIDED,
  ERROR_BIRTH_DATE_NOT_VALID,
  ERROR_COOKIE_PARSING,
  ERROR_MOTHER_NAME_NOT_PROVIDED,
  ERROR_NO_REDIRECT_URL_FOUND,
  ERROR_STUDENT_NAME_NOT_PROVIDED,
  ERROR_UNKNOWN,
  ERROR_USER_DOESNT_EXIST,
  ERROR_YEAR_NOT_IN_RANGE,
  ERROR_YEAR_NOT_PROVIDED,
  ERROR_YEAR_NOT_VALID,
  ERROR_FETCHING_BOLETIM_URL
} from "./error";

export function validateRequestParameters(query: {
  [key: string]: string;
}): Result<BoletimFetchRequest, { code: number; message: string }> {
  if (!query.studentName) {
    return Err({
      code: ERROR_STUDENT_NAME_NOT_PROVIDED,
      message: "The 'studentName' field was not supplied",
    });
  }

  const studentName = query.studentName;

  if (!query.motherName) {
    return Err({
      code: ERROR_MOTHER_NAME_NOT_PROVIDED,
      message: "The 'motherName' field was not supplied",
    });
  }

  const motherName = query.motherName;

  if (!query.year) {
    return Err({
      code: ERROR_YEAR_NOT_PROVIDED,
      message: "The 'year' field was not supplied",
    });
  }

  const yearString = query.year;

  if (!yearString.match(/[0-9]{4}/g)) {
    return Err({
      code: ERROR_YEAR_NOT_VALID,
      message: "The 'year' field doesn't matches the format YYYY",
    });
  }

  const year = parseInt(yearString);

  if (year < 2020 || year > 2025) {
    return Err({
      code: ERROR_YEAR_NOT_IN_RANGE,
      message: "The 'year' field is not in the range 2020 <= n <= 2025",
    });
  }

  if (!query.birthDate) {
    return Err({
      code: ERROR_BIRTH_DATE_NOT_PROVIDED,
      message: "The 'birthDate' field was not supplied",
    });
  }

  const birthDate = query.birthDate;

  if (!birthDate.match(/[0-9]{2}\/[0-9]{2}\/[0-9]{4}/g)) {
    return Err({
      code: ERROR_BIRTH_DATE_NOT_VALID,
      message: "The 'birthDate' field doesn't matches the format dd/mm/YYYY",
    });
  }

  return Ok({
    birthDate,
    motherName,
    studentName,
    year,
  });
}

function parseCookies(cookieString: string): Result<object, { code: number; message: string }> {
  try {
    let cookies: { [key: string]: string } = {};
    let parts = cookieString.split(";");

    for (let part of parts) {
      let [key, value] = part.split("=");
      cookies[key.trim()] = value.trim();
    }

    return Ok(cookies);
  } catch (e) {
    return Err({
      code: ERROR_COOKIE_PARSING,
      message: e.message
    });
  }
}

export async function sendFormRequest(
  request: BoletimFetchRequest,
): Promise<Result<BoletimFetchResponse, { code: number; message: string }>> {
  const { studentName, motherName, birthDate, year } = request;

  let body = new URLSearchParams({
    txtAnoLetivo: year.toString(),
    txtDataNascimento: birthDate,
    txtNomeAluno: studentName.toLowerCase(),
    txtNomeMae: motherName.toLowerCase(),
    rdTipoBoletim: "1",
    btnVisualiza: "Pesquisar",
  });

  try {
    let response = await fetch(BASE_SEDUC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body,
    });

    let text = await response.text();

    if (text.indexOf("O aluno informado") != -1) {
      return Err({
        code: ERROR_USER_DOESNT_EXIST,
        message: "The user doesn't exist"
      });
    }

    let windowLocation = text.lastIndexOf("window.location");

    if (windowLocation <= 0) {
      return Err({
        code: ERROR_USER_DOESNT_EXIST,
        message: "The user doesn't exist"
      });
    }

    let semicolonLocation = text.slice(windowLocation).indexOf("';") + 2; // To include the ';
    let line = text.slice(windowLocation).slice(0, semicolonLocation);

    // Now get everything inside single quotes
    let result = /window\.location = '(.*?)';/g.exec(line)?.[1];

    if (!result) {
      return Err({
        code: ERROR_NO_REDIRECT_URL_FOUND,
        message: "No redirection URL found."
      });
    }

    let cookies = unwrap(
      parseCookies(response.headers.get("Set-Cookie") || ""),
    );

    return Ok({ actionUrl: result, sessionId: cookies["PHPSESSID"] });
  } catch (e) {
    return Err({
      code: ERROR_UNKNOWN,
      message: e.message
    });
  }
}

async function getBoletimURL(
  fetchResponse: BoletimFetchResponse,
): Promise<Result<string, { code: number, message: string }>> {
  try {
    const { actionUrl, sessionId } = fetchResponse;

    let response = await fetch(BASE_SEDUC_URL + actionUrl, {
      headers: {
        Cookie: `PHPSESSID=${sessionId}`,
      },
    });

    if (response.status != 200) {
      return Err({
        code: ERROR_FETCHING_BOLETIM_URL,
        message: response.statusText
      });
    }

    return Ok("visualizaBoletim.php");
  } catch (e) {
    return Err({ code: ERROR_UNKNOWN, message: e.message });
  }
}

const parseDataTable = (
  dataTable: Element,
): Result<BoletimInformation, { code: number, message: string }> => {
  try {
    const TABLE_FIELD_TO_DATA_TABLE: {
      [key: string]: keyof BoletimInformation;
    } = {
      Escola: "school",
      "Aluno(a)": "name",
      "Data de Nascimento": "birthDate",
      Curso: "course",
      Série: "grade",
      Turma: "class",
      Turno: "shift",
      Cidade: "city",
      Estado: "state",
      "Ano Letivo": "academicYear",
    };

    let data: BoletimInformation = {
      school: "",
      name: "",
      course: "",
      class: "",
      city: "",
      birthDate: "",
      grade: "",
      shift: "",
      state: "",
      academicYear: "",
    };

    let rows: NodeList = dataTable.querySelectorAll("tbody > tr");

    for (let row of rows) {
      let children = row.childNodes;
      let nextIsValue = false;
      let key: keyof BoletimInformation | null = null;

      for (let child of children) {
        let name = child.nodeName.toLowerCase();
        let content = child.textContent!;

        if (name == "#text" || name == "#comment") continue;

        if (name == "th" && nextIsValue) {
          return Err({ code: ERROR_UNKNOWN, message: "Malformed table data" });
        } else if (name == "th") {
          nextIsValue = true;

          let normalizedName = content
            .replaceAll(":", "")
            .replaceAll(/ - ([0-9]*)/g, "")
            .trim();

          if (!TABLE_FIELD_TO_DATA_TABLE[normalizedName]) {
            continue;
          }

          key = TABLE_FIELD_TO_DATA_TABLE[normalizedName];

          continue;
        }

        if (name == "td" && !nextIsValue) {
          return Err({ code: ERROR_UNKNOWN, message: "Malformed table data" });
        } else if (name == "td") {
          nextIsValue = false;

          if (key) {
            data[key] = content.trim() == "" ? "" : content.trim();
          }

          key = null;
          continue;
        }
      }
    }

    return Ok(data);
  } catch (e) {
    return Err({ code: ERROR_UNKNOWN, message: e.message });
  }
};

const parseCurricularDataTable = (
  gradesTable: Element,
): Result<BoletimGrade[], { code: number, message: string }> => {
  try {
    let data: BoletimGrade[] = [];
    let rows = gradesTable.querySelectorAll("tbody > tr");

    const ROW_DATA_NAME_FROM_INDEX = [
      "subject",
      "grades",
      "grades",
      "grades",
      "grades",
      "annualGradeAverage",
      "absences",
      "annualFrequence",
      "finalResult",
    ];
    const INDEX_OF_GRADES = ROW_DATA_NAME_FROM_INDEX.indexOf("grades");

    for (let row of rows) {
      let rowIndex = 0;
      let hasData = false;
      let rowData: BoletimGrade = {
        subject: "",
        grades: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
        },
        annualGradeAverage: 0,
        absences: 0,
        annualFrequence: 0,
        finalResult: undefined,
      };

      let children = row.childNodes;
      let skipRow = false;

      for (let child of children) {
        if (skipRow) continue;

        let name = child.nodeName.toLowerCase();
        let content = child.textContent!;

        if (name == "#text" || name == "#comment") continue;

        if (
          content == "Componentes Curriculares" ||
          content == "1ª Av" ||
          content == "Resultado Final Matrícula Regular: " ||
          content == "Frequência Anual(%):"
        ) {
          skipRow = true;
          continue;
        }

        let dataName = ROW_DATA_NAME_FROM_INDEX[rowIndex];

        if (dataName == "grades") {
          let gradeIndex = INDEX_OF_GRADES + rowIndex - 1;

          rowData.grades[gradeIndex] = parseFloat(
            content.trim().replace(",", "."),
          );
          hasData = true;
        } else {
          if (dataName != "subject" && dataName != "finalResult")
            rowData[dataName] = parseFloat(content.trim().replace(",", "."));
          else {
            rowData[dataName] = (
              content.trim() == "-" ? undefined : content.trim()
            ) as keyof typeof rowData.finalResult;
          }

          hasData = true;
        }

        rowIndex++;
      }

      if (!skipRow && hasData) data.push(rowData);
    }

    return Ok(data);
  } catch (e) {
    return Err({ code: ERROR_UNKNOWN, message: e.message });
  }
};

const getBoletim = async (
  response: BoletimFetchDataRequest,
): Promise<Result<Boletim, { code: number, message: string }>> => {
  const { boletimUrl, sessionId } = response;
  try {
    let response = await fetch(BASE_SEDUC_URL + boletimUrl, {
      headers: {
        Cookie: `PHPSESSID=${sessionId}`,
      },
    });

    if (response.status != 200) {
      return Err({ code: ERROR_UNKNOWN, message: response.statusText });
    }

    let text = await response.text();

    let boletim: Boletim = {
      information: {
        school: "",
        name: "",
        course: "",
        class: "",
        city: "",
        birthDate: "",
        grade: "",
        shift: "",
        state: "",
        academicYear: "",
      },
      grades: [],
    };

    const { document } = new JSDOM(text).window;

    let tables = document.querySelectorAll("table.table");

    for (let table of tables) {
      let dataTable =
        table.querySelector("tbody>tr>th>strong")?.innerHTML == "Escola:";

      if (dataTable) {
        boletim.information = unwrap(parseDataTable(table));
        continue;
      }

      boletim.grades = unwrap(parseCurricularDataTable(table));
    }

    return Ok(boletim);
  } catch (e) {
    return Err({ code: ERROR_UNKNOWN, message: e.message });
  }
};

export async function fetchBoletim(
  request: BoletimFetchRequest,
): Promise<Result<Boletim, { code: number, message: string }>> {
  try {
    let response = unwrap(await sendFormRequest(request));

    let boletimUrl = unwrap(await getBoletimURL(response));
    let boletim = unwrap(
      await getBoletim({ boletimUrl, sessionId: response.sessionId }),
    );

    return Ok(boletim);
  } catch (err) {
    return Err(err);
  }
}

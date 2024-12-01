import { JSDOM } from "jsdom";
import { Ok, Err, unwrap, Result } from "../util/error";

export type BoletimInformation = {
    school: string;
    name: string;
    course: string;
    class: string;
    city: string;
    birthDate: string;
    grade: string;
    shift: string;
    state: string;
    academicYear: string;
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

function parseCookies(cookieString: string): Result<object, string> {
    try {
        let cookies: { [key: string]: string } = {};
        let parts = cookieString.split(";");

        for (let part of parts) {
            let [key, value] = part.split("=");
            cookies[key.trim()] = value.trim();
        }

        return Ok(cookies);
    } catch (e) {
        return Err(e.message);
    }
}

export async function sendFormRequest(
    request: BoletimFetchRequest,
): Promise<Result<BoletimFetchResponse, string>> {
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
            return Err("The user doesn't exist");
        }

        let windowLocation = text.lastIndexOf("window.location");

        if (windowLocation <= 0) {
            return Err("The user doesn't exist");
        }

        let semicolonLocation = text.slice(windowLocation).indexOf("';") + 2; // To include the ';
        let line = text.slice(windowLocation).slice(0, semicolonLocation);

        // Now get everything inside single quotes
        let result = /window\.location = '(.*?)';/g.exec(line)?.[1];

        if (!result) {
            return Err("No redirection URL found.");
        }

        let cookies = unwrap(
            parseCookies(response.headers.get("Set-Cookie") || ""),
        );

        return Ok({ actionUrl: result, sessionId: cookies["PHPSESSID"] });
    } catch (e) {
        return Err(e.message);
    }
}

async function getBoletimURL(
    fetchResponse: BoletimFetchResponse,
): Promise<Result<string, string>> {
    try {
        const { actionUrl, sessionId } = fetchResponse;

        let response = await fetch(BASE_SEDUC_URL + actionUrl, {
            headers: {
                Cookie: `PHPSESSID=${sessionId}`,
            },
        });

        if (response.status != 200) {
            return Err(response.statusText);
        }

        return Ok("visualizaBoletim.php");
    } catch (e) {
        return Err(e.message);
    }
}

const parseDataTable = (
    dataTable: Element,
): Result<BoletimInformation, string> => {
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
                    return Err("Malformed table data");
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
                    return Err("Malformed table data");
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
        return Err(e.message);
    }
};

const parseCurricularDataTable = (
    gradesTable: Element,
): Result<BoletimGrade[], string> => {
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
                        rowData[dataName] = parseFloat(
                            content.trim().replace(",", "."),
                        );
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
        return Err(e.message);
    }
};

const getBoletim = async (
    response: BoletimFetchDataRequest,
): Promise<Result<Boletim, string>> => {
    const { boletimUrl, sessionId } = response;
    try {
        let response = await fetch(BASE_SEDUC_URL + boletimUrl, {
            headers: {
                Cookie: `PHPSESSID=${sessionId}`,
            },
        });

        if (response.status != 200) {
            return Err(response.statusText);
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
                table.querySelector("tbody>tr>th>strong")?.innerHTML ==
                "Escola:";

            if (dataTable) {
                boletim.information = unwrap(parseDataTable(table));
                continue;
            }

            boletim.grades = unwrap(parseCurricularDataTable(table));
        }

        return Ok(boletim);
    } catch (e) {
        return Err(e.message);
    }
};

export async function fetchBoletim(
    request: BoletimFetchRequest,
): Promise<Result<Boletim, string>> {
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

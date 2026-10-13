export interface CoproprietorData {
    apto: string;
    unitName: string;
    propietario: string;
    aliquot: number; // percentage, e.g. 3.683168
    email: string | null;
    phone: string | null;
}

export const GRANADA_COPROPRIETORS: CoproprietorData[] = [
    { apto: '02', unitName: '0-2', propietario: 'ANGEL DANIEL LOBO BUCAN', aliquot: 3.683168, email: 'Davianlobowolf@gmail.com', phone: '0424-297-27-27' },
    { apto: '03', unitName: '0-3', propietario: 'SORAYA SULBARAN', aliquot: 3.960396, email: 'soraya4243@hotmail.com', phone: '0414-278-33-31' },
    { apto: '04', unitName: '0-4', propietario: 'GABRIEL HERNANDEZ', aliquot: 3.247525, email: 'gabrieljhg@gmail.com', phone: '0414-215-51-33' },
    { apto: '11', unitName: '1-1', propietario: 'CELINA TOVAR ROBLES', aliquot: 3.247525, email: 'guiseppegreco58@gmail.com', phone: '0412-242-73-74' },
    { apto: '12', unitName: '1-2', propietario: 'ELINA GRAU ZAMBRANO', aliquot: 3.247525, email: 'egrau16@hotmail.com', phone: '0424-284-14-46' },
    { apto: '13', unitName: '1-3', propietario: 'JOSE LUIS GIL', aliquot: 3.683168, email: 'desidereeri@gmail.com', phone: '0412-399-52-29' },
    { apto: '14', unitName: '1-4', propietario: 'NELLY ERCILIA GUERRA', aliquot: 3.683168, email: 'nguerrae2@gmail.com', phone: '0412-226-42-00' },
    { apto: '21', unitName: '2-1', propietario: 'YELITZA COMOROTO MIJARES Y FRANKLIN ALBORNOZ', aliquot: 3.247525, email: 'yelitzarosariomijares@outlook.com', phone: null },
    { apto: '22', unitName: '2-2', propietario: 'ANGELICA BRITO', aliquot: 3.247525, email: null, phone: '0414-109-44-41' },
    { apto: '23', unitName: '2-3', propietario: 'JHOLBERT CARO Y ARGELIS MORENO', aliquot: 3.683168, email: 'jholbert.c@gmail.com', phone: '0412-387-06-54' },
    { apto: '24', unitName: '2-4', propietario: 'MAYKOL MARCANO', aliquot: 3.683168, email: 'maykol_a85@hotmail.com', phone: '0424-370-76-14' },
    { apto: '31', unitName: '3-1', propietario: 'MARIA A. CAMPOS TARIN', aliquot: 3.247525, email: 'macampost14@hotmail.com', phone: '0414-238-10-13' },
    { apto: '32', unitName: '3-2', propietario: 'MARIA JOSEFINA GLECIANO', aliquot: 3.247525, email: 'riobuenoraquel@gmail.com', phone: '0424-232-42-79' },
    { apto: '33', unitName: '3-3', propietario: 'SEBASTIAN FIGUEIRA', aliquot: 3.683168, email: 'josmaryavendano@gmail.com', phone: '0414-020-36-60' },
    { apto: '34', unitName: '3-4', propietario: 'MIGUEL ABREU', aliquot: 3.683168, email: 'Miguelmalhante73@gmail.com', phone: '0414-907-83-54' },
    { apto: '41', unitName: '4-1', propietario: 'JEESID GIMENEZ', aliquot: 3.247525, email: 'miriamalonzo3@gmail.com', phone: '0414-139-14-43' },
    { apto: '42', unitName: '4-2', propietario: 'JOSE ZAMBRANO', aliquot: 3.247525, email: null, phone: '0414-217-76-33' },
    { apto: '43', unitName: '4-3', propietario: 'ANA DIAZ BUSTAMANTE Y STYVER JOSUE MARQUEZ', aliquot: 3.683168, email: 'isabeldb07@gmail.com', phone: '0424-159-45-18' },
    { apto: '44', unitName: '4-4', propietario: 'TITA CLARISA FREITES DE RIOS', aliquot: 3.683168, email: 'clarissafreites@hotmail.com', phone: '0426-377-75-13' },
    { apto: '51', unitName: '5-1', propietario: 'GIUSEPPE MIGUEL GRECO', aliquot: 3.247525, email: 'giuseppegreco58@gmail.com', phone: '0412-242-73-74' },
    { apto: '52', unitName: '5-2', propietario: 'FRANCIA FORMICA', aliquot: 3.247525, email: 'felix.paganelli@hotmail.com', phone: '0414-304-61-46' },
    { apto: '53', unitName: '5-3', propietario: 'EDGAR COLMENARES', aliquot: 3.683168, email: 'bettinacolmenares@yahoo.es', phone: '0414-324-03-50' },
    { apto: '54', unitName: '5-4', propietario: 'ROBISON LA ROSA Y YULEINIS GUZMAN', aliquot: 3.683168, email: 'yuleinis.gb@gmail.com', phone: '0414-211-16-62' },
    { apto: '61', unitName: '6-1', propietario: 'GAUDYS MORENO', aliquot: 3.247525, email: 'judithiriarteibarra@hotmail.com', phone: '0424-198-00-35' },
    { apto: '62', unitName: '6-2', propietario: 'JOSE RODRIGUEZ REY', aliquot: 3.247525, email: 'pilyrr18@homtail.com', phone: '0414-303-45-81' },
    { apto: '63', unitName: '6-3', propietario: 'YSVANSLEY MORENO GOMEZ', aliquot: 3.683168, email: null, phone: '0424-267-92-80' },
    { apto: '64', unitName: '6-4', propietario: 'PILAR REY DE RODRIGUEZ', aliquot: 3.683168, email: 'pilyrr18@hotmail.com', phone: '0414-303-45-81' },
    { apto: 'PH', unitName: 'P-H', propietario: 'MARIA J. FARRE DE YAMMINE', aliquot: 5.940595, email: 'vanemrg@gmail.com', phone: '0412-275-82-63' }
];

/**
 * Normalizes a unit name (e.g. "2-3", "23", "P-H", "PH") to find its coproprietor data
 */
export function getGranadaCoproprietor(unitName: string): CoproprietorData | undefined {
    if (!unitName) return undefined;
    const clean = unitName.trim().toUpperCase().replace(/\s+/g, '');
    return GRANADA_COPROPRIETORS.find(c => 
        c.unitName.toUpperCase() === clean ||
        c.apto.toUpperCase() === clean ||
        clean.endsWith(c.unitName.toUpperCase()) ||
        clean.endsWith(c.apto.toUpperCase())
    );
}

/**
 * Formats unit name nicely for display (e.g. "2-3" -> "Apto 23 (2-3)")
 */
export function formatUnitDisplay(unitName: string): string {
    const coprop = getGranadaCoproprietor(unitName);
    if (coprop) {
        return `Apto ${coprop.apto}`;
    }
    return `Unidad ${unitName}`;
}

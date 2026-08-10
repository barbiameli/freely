import type { Dictionary } from "@/lib/i18n/en";

/**
 * Every string in the interface, in Spanish.
 *
 * Written as a freelancer would say it, not translated word by word. Where a
 * literal translation would read like a manual, the Spanish says the same
 * thing in its own way: "Pick up where you left off" becomes "Sigue donde lo
 * dejaste" rather than a longer literal rendering.
 *
 * Neutral Spanish throughout, and "tú" rather than "usted", here and in the
 * generated quotes: freelance work is a relationship between two people, and
 * "usted" puts a desk between them. A freelancer who wants "usted" can say so
 * in their tone notes, which the generation prompt reads. Terms the industry
 * uses in English (brief, PDF, Figma) stay in English, because translating
 * them would be less clear, not more.
 *
 * Typed as Dictionary, so a missing or spare key fails the build.
 */
export const es: Dictionary = {
  common: {
    save: "Guardar",
    saveChanges: "Guardar cambios",
    cancel: "Cancelar",
    delete: "Eliminar",
    edit: "Editar",
    add: "Añadir",
    back: "Atrás",
    continue: "Continuar",
    close: "Cerrar",
    keep: "Conservar",
    optional: "Opcional",
    required: "Obligatorio",
    saving: "Guardando...",
    deleting: "Eliminando...",
    working: "Trabajando...",
    loading: "Cargando",
    seeAll: "Ver todos",
    tryAgain: "Reintentar",
    somethingWentWrong: "No ha funcionado. Vuelve a intentarlo.",
    noConnection: "No se ha podido conectar. Revisa tu conexión y vuelve a intentarlo.",
    forExample: "Por ejemplo",
    commonOnes: "Las más habituales",
  },

  nav: {
    quote: "Presupuestar",
    track: "Seguimiento",
    diary: "Diario",
    invoices: "Facturas",
    memory: "Memoria",
    team: "Equipo",
    account: "Cuenta",
    signOut: "Cerrar sesión",
    language: "Idioma",
  },

  quote: {
    eyebrowStep1: "Presupuesto - Paso 1 de 2",
    eyebrowStep2: "Presupuesto - Paso 2 de 2",
    stepBrief: "El brief",
    stepQuote: "El presupuesto",
    titleStep1: "¿Qué vamos a presupuestar?",
    subtitleStep1:
      "Todo lo que da forma al presupuesto. Solo hacen falta el brief y tu tarifa.",
    titleStep2: "¿Cómo lo presentamos?",
    subtitleStep2: "Qué aspecto tiene el presupuesto final y qué incluye.",

    pickUpWhereYouLeftOff: "Sigue donde lo dejaste",
    everyQuote: "Todos tus presupuestos.",
    newQuote: "Nuevo presupuesto",
    nothingHereYet: "Aquí todavía no hay nada.",
    makeYourFirst: "Crea tu primer presupuesto",
    sendToTrack: "Pasar a Seguimiento",
    sending: "Enviando...",
    tracked: "En seguimiento",
    inTrack: "En Seguimiento",
    draft: "Borrador",
    published: "Publicado",
    deleteThisDraft: "Eliminar este borrador",

    uploadBrief: "Subir un brief",
    uploadBriefHint: "PDF, DOCX o un archivo de texto.",
    pasteText: "Pegar texto",
    pasteTextHint: "Notas, una transcripción o un alcance que hayas escrito.",
    reading: "Leyendo...",

    howShouldItRun: "¿Cómo debería funcionar este proyecto?",
    howShouldItRunHint:
      "Lo que ya tengas decidido sobre este trabajo en concreto: cómo se cobra, cómo se divide y qué hay que acordar antes de pasar a la siguiente parte.",
    howShouldItRunPlaceholder:
      "p. ej. es largo, así que quiero cerrar la dirección visual antes de la fase de diseño, y dividir el pago en tres hitos",
    workedOutFromBrief:
      "Si lo dejas en blanco, se decide a partir del brief y de tus presupuestos anteriores.",

    yourRate: "Tu tarifa",
    perHour: "Por hora",
    perDay: "Por día",
    usedAsTyped: "Se usa exactamente como la escribas.",
    orResearched: "O deja que se investigue una.",
    notSureWhatToCharge: "¿No sabes cuánto cobrar?",
    iKnowMyRate: "Sé cuál es mi tarifa",
    rememberThisRate: "Recordar esta como mi tarifa habitual",
    expertise: "Tu nivel de experiencia",
    expertiseHint: "Se usa cuando no das una tarifa, para investigar una realista.",

    pricedFor: "¿Para qué mercado es el presupuesto?",
    pricedForHint:
      "El mismo trabajo se paga muy distinto según el mercado, así que la ubicación es lo único imprescindible para investigar una tarifa.",
    pricedForFooter: "Hace falta tu ubicación o la del cliente. El resto es opcional.",
    yourLocation: "Dónde estás tú",
    clientLocation: "Dónde está el cliente",
    clientType: "Qué tipo de cliente",
    budgetHint: "Algo que hayan dicho del presupuesto",
    urgency: "Plazos",
    experienceNote: "¿Has hecho antes este tipo de trabajo?",

    addSections: "Añadir secciones",
    addSectionsHint:
      "Todo presupuesto incluye el alcance, los entregables y el precio. Añade lo que necesite este en concreto. Cuando una sección te haga una pregunta, responderla es opcional: si la dejas en blanco, se decide a partir del brief y de tus presupuestos anteriores.",
    availabilityPrompt:
      "¿Hay algo concreto que merezca la pena decir? Fechas de inicio, cuánto tiempo puedes dedicarle o que la disponibilidad no queda reservada hasta aceptar el presupuesto.",
    availabilitySkipped:
      "Si lo dejas en blanco, esta sección se omite en lugar de inventarse.",

    availabilityPlaceholder: "p. ej. podría empezar la primera semana de septiembre, dos días por semana, sin reservar hasta aceptar",
    quoteLanguage: "Idioma del presupuesto",
    quoteLanguageHint: "El idioma en el que se escribe el presupuesto, que no tiene que ser el tuyo.",

    generate: "Generar brief",
    stop: "Parar",
    generatingTooLong:
      "Esto está tardando más de lo normal. Puede que termine en segundo plano, pero no te quedes esperando. Vuelve a intentarlo o simplifica primero el material de origen (un archivo muy grande lo ralentiza bastante).",
    generateFailed: "Algo ha fallado al generar el brief. Vuelve a intentarlo.",

    addSource: "Añade material de origen antes de generar un brief.",
    addRateOrLocation: "Añade tu tarifa o indica dónde estáis tú o el cliente.",
    addRateOrLocationLong:
      "Añade tu tarifa o indica dónde estáis tú o el cliente para poder investigar una.",
    output: "Resultado",
    outputHint: "Lo que recibe el cliente y qué aspecto tiene.",
    pageFormat: "Formato de la página",
    briefHistory: "Historial de briefs",
    chooseFile: "Elegir archivo",
    visualReferences: "Referencias visuales",
    removeExample: "Quitar referencia",
    whatShouldClientTake: "¿Qué quieres que vea el cliente aquí?",
    pasteHere: "Pega aquí el brief, el email o las notas del cliente...",
    transparentPng: "PNG con fondo transparente.",
    exampleFixedPrice: "Precio cerrado en vez de por horas",
    exampleMilestones: "Dividirlo en hitos con un pago en cada uno",
    exampleDirectionFirst: "Cerrar la dirección visual antes de empezar a diseñar",
    exampleResearchFirst: "Hacer la investigación primero y presentar hallazgos antes de definir el resto",
    askPayment: "¿Cómo quieres cobrar?",
    askPaymentPlaceholder: "p. ej. 40% por adelantado, el resto a la entrega, facturando en cada hito",
    askTerms: "¿Tienes condiciones que apliques siempre?",
    askTermsPlaceholder: "p. ej. dos semanas de preaviso para cancelar, los derechos son míos hasta cobrar la última factura",
    askRevisions: "¿Cuántas rondas incluyes?",
    askRevisionsPlaceholder: "p. ej. dos rondas por entregable, lo que venga después se presupuesta aparte",
    askAiUsage: "¿Qué IA usas de verdad, y para qué?",
    askAiUsagePlaceholder: "p. ej. Claude para primeros borradores de textos y variantes repetitivas, nunca para decisiones de diseño",
    sectionStrategy: "Estrategia",
    sectionStrategyHint: "El objetivo, lo que dice el brief y lo que queda por confirmar.",
    sectionTimeline: "Calendario",
    sectionTimelineHint: "Un desglose semana a semana.",
    sectionSow: "Contrato de trabajo",
    sectionSowHint: "Hace el presupuesto firmable, con condiciones de pago y qué pasa si cambia el alcance.",
    sectionTerms: "Condiciones",
    sectionTermsHint: "Cancelación, propiedad del trabajo y confidencialidad.",
    sectionRevisions: "Política de revisiones",
    sectionRevisionsHint: "Cuántas rondas se incluyen y qué cuenta como trabajo nuevo.",
    sectionAvailability: "Disponibilidad",
    sectionAvailabilityHint: "Tu capacidad, fecha de inicio y en cuánto respondes.",
    sectionAi: "Uso de IA",
    sectionAiHint: "Qué partes del proyecto usan IA y cuáles son del todo humanas.",
    dragFileHere: "Arrastra un archivo aquí, o haz clic para elegir uno (.txt, .md, .pdf, .docx).",
    uploading: "Subiendo...",
    logo: "Logo",
  },

  brief: {
    quotationDraft: "Presupuesto, borrador",
    quotationPublished: "Presupuesto, publicado",
    editOverview: "Editar resumen",
    total: "Total",
    scope: "Alcance",
    deliverables: "Entregables",
    timeline: "Calendario",
    strategy: "Estrategia",
    investment: "Inversión",
    downloadPdf: "Descargar PDF",
    buildingPdf: "Generando el PDF...",
    pdfFailed: "No se ha podido generar el PDF. Inténtalo en un momento.",
    addToTrack: "Pasar a Seguimiento",
    addToTrackFailed: "No se ha podido pasar a Seguimiento. Vuelve a intentarlo.",
    publish: "Publicar",
    unpublish: "Dejar de publicar",
    copyLink: "Copiar enlace",
    copied: "Copiado",
    hoursNeedNumber: "Las horas tienen que ser un número.",
    priceNeedNumber: "El precio tiene que ser un número.",
    oneDeliverablePerLine: "Un entregable por línea. Borra una línea para quitarlo.",
    workingDraft: "Este es tu borrador de trabajo.",
    originalRequest: "Petición original",
    refine: "Afinar",
  },

  track: {
    eyebrow: "Seguimiento",
    allProjects: "Todos los proyectos",
    done: "Hecho",
    pace: "Ritmo",
    nextUp: "Lo siguiente",
    hours: "Horas",
    notScheduled: "Sin fechas",
    nothingDated: "Nada con fecha",
    paceAhead: "adelantado",
    paceOnTrack: "en plazo",
    paceSlipping: "empezando a retrasarse",
    paceBehind: "retrasado",

    whenDoesThisStart: "¿Cuándo empieza?",
    whenDoesThisStartHint:
      "El presupuesto dice cuánto dura cada etapa. Una fecha de inicio la convierte en fechas reales en cada entregable, que después puedes mover una a una.",
    setTheSchedule: "Fijar el calendario",
    scheduling: "Fijando...",
    reschedule: "Recalcular fechas",
    rescheduleWarning:
      "Esto vuelve a calcular todas las fechas. Las que hayas movido a mano vuelven a la fecha calculada.",

    comingUp: "Próximamente",
    hideComingUp: "Ocultar lo próximo",
    worthRaising: "Vale la pena plantear",
    allAnswered: "Todo resuelto.",
    answered: "Resueltas",
    reopen: "Reabrir",
    needsAnAnswer: "Necesita respuesta",
    assuming: "Damos por hecho",
    worthAsking: "Vale la pena preguntar",

    deliverables: "Entregables",
    noDeliverables: "No hay entregables.",
    addDeliverable: "Añadir un entregable",
    breakThisDown: "Desglosar",
    workingItOut: "Desglosando...",
    redo: "Rehacer",
    editSteps: "Editar pasos",
    oneStepPerLine:
      "Un paso por línea. Borra una línea para quitarla, añade una línea para sumar un paso.",
    saveSteps: "Guardar pasos",
    setDate: "Poner fecha",
    changeThisDate: "Cambiar esta fecha",
    noStepsYet: "Este todavía no tiene pasos.",

    workingOutSteps: "Calculando los pasos",
    allBrokenDown: "Todo desglosado",
    lastDone: "Último hecho",

    projectDetails: "Detalles del proyecto",
    hide: "Ocultar",
    price: "Precio",
    hoursBudgeted: "Horas presupuestadas",
    hoursLogged: "Horas registradas",
    status: "Estado",
    sendToDiary: "Pasar al Diario",
    generateInvoice: "Generar factura",
    deleteProject: "Eliminar proyecto",
    projectTitle: "Título del proyecto",
    clientName: "Nombre del cliente",
    deleteProjectLabel: "Eliminar proyecto",
  },

  memory: {
    title: "Memoria",
    instructions: "Instrucciones",
    tone: "Tono",
    story: "Trayectoria y contexto",
    files: "Archivos",
    branding: "Marca",
    connections: "Conexiones",
    comingSoon: "Próximamente",
    yourUsualRate: "Tu tarifa habitual",
    yourUsualRateHint:
      "Se rellena sola en cada presupuesto, y puedes cambiarla en cualquiera de ellos.",
  },

  invoices: {
    title: "Facturas",
    newInvoice: "Nueva factura",
    invoiceNumber: "Factura",
    paid: "Marcada como pagada.",
    notPaid: "Todavía sin pagar.",
    paymentDetails: "Datos de pago",
    paymentNotStored: "Van en el PDF y no se guardan en ningún momento.",
    download: "Descargar",
    noInvoices: "Todavía no hay facturas.",
  },

  diary: {
    title: "Diario",
    addEntry: "Añadir entrada",
    noEntries: "Todavía no hay entradas.",
    clientSite: "Página para el cliente",
    publish: "Publicar",
    published: "Publicada",
  },

  account: {
    title: "Cuenta",
    name: "Nombre",
    studioName: "Nombre del estudio",
    changePassword: "Cambiar la contraseña",
    currentPassword: "Contraseña actual",
    newPassword: "Contraseña nueva",
    deleteAccount: "Eliminar la cuenta",
    nameEmpty: "El nombre no puede estar vacío.",
  },

  team: {
    title: "Equipo",
    members: "Miembros",
    justYou: "Por ahora solo estás tú, invita a alguien arriba.",
    pendingInvites: "Invitaciones pendientes",
    invite: "Invitar",
    shareableLink: "Enlace para compartir",
    copyLink: "Copiar enlace",
    revoke: "Anular",
    removeFromTeam: "Quitar del equipo",
    you: "(tú)",
  },

  errors: {
    pageTitle: "Esta página no ha cargado.",
    pageBody: "Ha fallado algo por nuestra parte, no por la tuya. Tu trabajo está guardado.",
    goToQuote: "Ir a Presupuestar",
    reference: "Referencia",
    rootTitle: "Algo ha fallado.",
    rootBody: "Esta es culpa nuestra. Inténtalo en un momento.",
    notFoundTitle: "Aquí no hay nada.",
    notFoundBody: "Puede que se haya eliminado esta página o que el enlace esté mal.",
    backToFreely: "Volver a Freely",
  },
};

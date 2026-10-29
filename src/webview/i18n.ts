/** Localized webview strings. Keep stable English source keys and fall back to English. */
const portuguese: Record<string, string> = {
  Run: 'Executar',
  Stop: 'Parar',
  'Configure the act executable path': 'Configurar caminho do executável act',
  Graph: 'Grafo',
  History: 'Histórico',
  Analytics: 'Analytics',
  Settings: 'Configurações',
  'No workflow runs recorded yet.': 'Nenhuma execução registrada ainda.',
  'Filter workflow runs': 'Filtrar execuções de workflow',
  Actions: 'Ações',
  'Hide log': 'Ocultar log',
  'View log': 'Ver log',
  Rerun: 'Reexecutar',
  Delete: 'Deletar',
  'Delete selected': 'Deletar selecionados',
  'Select all runs on this page': 'Selecionar todas as execuções desta página',
  'Select run': 'Selecionar execução',
  'Stop workflow execution': 'Parar execução do workflow',
  Repository: 'Repositório',
  'Select repository': 'Selecionar repositório',
  Cancel: 'Cancelar',
  'Select...': 'Selecione...',
  'Open workflow sidebar': 'Abrir sidebar de workflows',
  'No workflow found in .github/workflows.': 'Nenhum workflow encontrado em .github/workflows.',
  'No logs for this step.': 'Nenhum log para este step.',
  'Waiting for execution...': 'Aguardando execução...',
  'No job loaded': 'Nenhum job carregado',
  'No GITHUB_STEP_SUMMARY detected in this execution.':
    'Nenhum GITHUB_STEP_SUMMARY detectado nesta execução.',
  'Invalid JSON - fix the payload before simulating.':
    'JSON inválido - corrija o payload antes de simular.',
  'Secrets should never be committed. Make sure':
    'Secrets nunca devem ser commitados. Verifique se',
  'is in': 'está no',
  'No history available yet. Run workflows to populate Analytics.':
    'Nenhum histórico disponível ainda. Execute workflows para alimentar o Analytics.',
  'No jobs with recorded duration.': 'Sem jobs com duração registrada.',
  Execution: 'Execução',
  all: 'todos',
  'No workflow running': 'Nenhum workflow em execução',
  'Select a workflow and click Run to view progress here.':
    'Selecione um workflow e clique em Executar para visualizar o progresso aqui.',
  Workflows: 'Workflows',
  Scripts: 'Scripts',
  'Apply template': 'Aplicar template',
  'No runs found for this filter.': 'Nenhuma execução encontrada para este filtro.',
  completed: 'concluído',
  'failed plural': 'falharam',
  'with inputs': 'com inputs',
};
const spanish: Record<string, string> = {
  Run: 'Ejecutar',
  Stop: 'Detener',
  Graph: 'Gráfico',
  History: 'Historial',
  Analytics: 'Análisis',
  Settings: 'Configuración',
  Cancel: 'Cancelar',
  Actions: 'Acciones',
  Rerun: 'Volver a ejecutar',
  Delete: 'Eliminar',
  'Select repository': 'Seleccionar repositorio',
  Workflows: 'Flujos de trabajo',
  Scripts: 'Scripts',
  'No workflow running': 'No hay flujos de trabajo en ejecución',
  'Select...': 'Seleccionar...',
  Repository: 'Repositorio',
  Summary: 'Resumen',
  Previous: 'Anterior',
  Next: 'Siguiente',
  'All workflow runs': 'Todas las ejecuciones',
  'Showing runs from all workflows': 'Mostrando ejecuciones de todos los flujos',
  'No workflow runs recorded yet.': 'Todavía no hay ejecuciones registradas.',
  'Filter workflow runs': 'Filtrar ejecuciones',
  'Delete selected': 'Eliminar seleccionados',
  'View log': 'Ver registro',
  'Hide log': 'Ocultar registro',
  'Waiting for execution...': 'Esperando la ejecución...',
};
const french: Record<string, string> = {
  Run: 'Exécuter',
  Stop: 'Arrêter',
  Graph: 'Graphe',
  History: 'Historique',
  Analytics: 'Analyses',
  Settings: 'Paramètres',
  Cancel: 'Annuler',
  Actions: 'Actions',
  Rerun: 'Relancer',
  Delete: 'Supprimer',
  'Select repository': 'Choisir un dépôt',
  Workflows: 'Workflows',
  Scripts: 'Scripts',
  'No workflow running': 'Aucun workflow en cours',
  'Select...': 'Sélectionner...',
  Repository: 'Dépôt',
  Summary: 'Résumé',
  Previous: 'Précédent',
  Next: 'Suivant',
  'All workflow runs': 'Toutes les exécutions',
  'Showing runs from all workflows': 'Affichage des exécutions de tous les workflows',
  'No workflow runs recorded yet.': 'Aucune exécution enregistrée.',
  'Filter workflow runs': 'Filtrer les exécutions',
  'Delete selected': 'Supprimer la sélection',
  'View log': 'Afficher le journal',
  'Hide log': 'Masquer le journal',
  'Waiting for execution...': 'En attente d’exécution...',
};
const catalogs: Record<string, Record<string, string>> = {
  es: spanish,
  fr: french,
  'pt-BR': portuguese,
};
export type SupportedLocale = 'en' | 'es' | 'fr' | 'pt-BR';
export function resolveLocale(language: string | undefined): SupportedLocale {
  const candidate = (language || 'en').toLowerCase().replace('_', '-');
  if (candidate.startsWith('pt')) return 'pt-BR';
  if (candidate.startsWith('es')) return 'es';
  if (candidate.startsWith('fr')) return 'fr';
  return 'en';
}
let locale: SupportedLocale = resolveLocale(
  typeof navigator === 'undefined' ? 'en' : navigator.language
);
export function setLocale(value: string): void {
  locale = resolveLocale(value);
}
export function getLocale(): SupportedLocale {
  return locale;
}
export function t(message: string, ...args: Array<string | number>): string {
  const value = catalogs[locale]?.[message] ?? message;
  return value.replace(/\{(\d+)\}/g, (_: string, i: string) =>
    String(args[Number(i)] ?? '{' + i + '}')
  );
}

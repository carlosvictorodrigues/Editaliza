/**
 * @file tests/unit/annotations/annotations-system.test.js
 * @description Testes unitários para o Sistema de Anotações
 * @jest-environment jsdom
 */

// Mock do sistema de anotações baseado na estrutura observada
const AnnotationsSystem = {
    // Armazenamento de anotações (simulando localStorage + backend)
    storage: {
        notes: new Map(),
        categories: new Map(),
        tags: new Set(),
        nextId: 1
    },

    // Configurações do sistema
    config: {
        maxNoteLength: 10000,
        maxTitleLength: 100,
        autoSaveInterval: 5000, // 5 segundos
        searchMinLength: 3,
        itemsPerPage: 20
    },

    // CRUD de Anotações
    crud: {
        // Criar nova anotação
        create: function(noteData) {
            const { title, content, categoryId, tags = [] } = noteData;
            
            // Validações
            if (!title || title.trim() === '') {
                throw new Error('Título é obrigatório');
            }
            
            if (title.length > AnnotationsSystem.config.maxTitleLength) {
                throw new Error(`Título deve ter no máximo ${AnnotationsSystem.config.maxTitleLength} caracteres`);
            }
            
            if (!content || content.trim() === '') {
                throw new Error('Conteúdo é obrigatório');
            }
            
            if (content.length > AnnotationsSystem.config.maxNoteLength) {
                throw new Error(`Conteúdo deve ter no máximo ${AnnotationsSystem.config.maxNoteLength} caracteres`);
            }

            const note = {
                id: AnnotationsSystem.storage.nextId++,
                title: title.trim(),
                content: content.trim(),
                categoryId: categoryId || null,
                tags: Array.isArray(tags) ? [...new Set(tags)] : [], // Remove duplicatas
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isPinned: false,
                isArchived: false,
                color: 'default'
            };

            AnnotationsSystem.storage.notes.set(note.id, note);
            
            // Adicionar tags ao conjunto global
            tags.forEach(tag => AnnotationsSystem.storage.tags.add(tag));

            return note;
        },

        // Ler anotação por ID
        read: function(noteId) {
            if (typeof noteId !== 'number') {
                throw new Error('ID da anotação deve ser um número');
            }

            const note = AnnotationsSystem.storage.notes.get(noteId);
            if (!note) {
                throw new Error(`Anotação com ID ${noteId} não encontrada`);
            }

            return { ...note }; // Retorna cópia para evitar mutação
        },

        // Atualizar anotação
        update: function(noteId, updateData) {
            const note = this.read(noteId); // Throws if not found
            
            const updatableFields = ['title', 'content', 'categoryId', 'tags', 'isPinned', 'isArchived', 'color'];
            const updates = {};
            
            // Validar e preparar atualizações
            for (const [key, value] of Object.entries(updateData)) {
                if (updatableFields.includes(key)) {
                    if (key === 'title' && value) {
                        if (value.length > AnnotationsSystem.config.maxTitleLength) {
                            throw new Error(`Título deve ter no máximo ${AnnotationsSystem.config.maxTitleLength} caracteres`);
                        }
                        updates.title = value.trim();
                    } else if (key === 'content' && value) {
                        if (value.length > AnnotationsSystem.config.maxNoteLength) {
                            throw new Error(`Conteúdo deve ter no máximo ${AnnotationsSystem.config.maxNoteLength} caracteres`);
                        }
                        updates.content = value.trim();
                    } else if (key === 'tags' && Array.isArray(value)) {
                        updates.tags = [...new Set(value)]; // Remove duplicatas
                        value.forEach(tag => AnnotationsSystem.storage.tags.add(tag));
                    } else {
                        updates[key] = value;
                    }
                }
            }

            // Aplicar atualizações
            const updatedNote = {
                ...note,
                ...updates,
                updatedAt: new Date().toISOString()
            };

            AnnotationsSystem.storage.notes.set(noteId, updatedNote);
            return updatedNote;
        },

        // Deletar anotação
        delete: function(noteId) {
            const note = this.read(noteId); // Throws if not found
            
            const deleted = AnnotationsSystem.storage.notes.delete(noteId);
            
            if (deleted) {
                return { success: true, deletedNote: note };
            } else {
                throw new Error('Falha ao deletar anotação');
            }
        },

        // Listar todas as anotações
        list: function(options = {}) {
            const { 
                categoryId = null, 
                tags = [], 
                includeArchived = false,
                sortBy = 'updatedAt',
                sortOrder = 'desc',
                page = 1,
                limit = AnnotationsSystem.config.itemsPerPage
            } = options;

            let notes = Array.from(AnnotationsSystem.storage.notes.values());

            // Filtros
            if (!includeArchived) {
                notes = notes.filter(note => !note.isArchived);
            }

            if (categoryId !== null) {
                notes = notes.filter(note => note.categoryId === categoryId);
            }

            if (tags.length > 0) {
                notes = notes.filter(note => 
                    tags.some(tag => note.tags.includes(tag))
                );
            }

            // Ordenação
            notes.sort((a, b) => {
                let comparison = 0;
                
                // Pinned notes always come first
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                
                if (sortBy === 'title') {
                    comparison = a.title.localeCompare(b.title);
                } else if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
                    comparison = new Date(a[sortBy]) - new Date(b[sortBy]);
                }
                
                return sortOrder === 'desc' ? -comparison : comparison;
            });

            // Paginação
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedNotes = notes.slice(startIndex, endIndex);

            return {
                notes: paginatedNotes,
                pagination: {
                    page,
                    limit,
                    total: notes.length,
                    totalPages: Math.ceil(notes.length / limit),
                    hasNextPage: endIndex < notes.length,
                    hasPrevPage: page > 1
                }
            };
        }
    },

    // Sistema de categorias
    categories: {
        // Criar categoria
        create: function(name, color = 'blue') {
            if (!name || name.trim() === '') {
                throw new Error('Nome da categoria é obrigatório');
            }

            const category = {
                id: AnnotationsSystem.storage.nextId++,
                name: name.trim(),
                color: color,
                createdAt: new Date().toISOString(),
                notesCount: 0
            };

            AnnotationsSystem.storage.categories.set(category.id, category);
            return category;
        },

        // Listar categorias
        list: function() {
            const categories = Array.from(AnnotationsSystem.storage.categories.values());
            
            // Contar notas em cada categoria
            categories.forEach(category => {
                category.notesCount = Array.from(AnnotationsSystem.storage.notes.values())
                    .filter(note => note.categoryId === category.id && !note.isArchived).length;
            });

            return categories.sort((a, b) => a.name.localeCompare(b.name));
        },

        // Deletar categoria
        delete: function(categoryId) {
            const category = AnnotationsSystem.storage.categories.get(categoryId);
            if (!category) {
                throw new Error(`Categoria com ID ${categoryId} não encontrada`);
            }

            // Verificar se há notas na categoria
            const notesInCategory = Array.from(AnnotationsSystem.storage.notes.values())
                .filter(note => note.categoryId === categoryId);

            if (notesInCategory.length > 0) {
                throw new Error('Não é possível deletar categoria que contém anotações');
            }

            return AnnotationsSystem.storage.categories.delete(categoryId);
        }
    },

    // Sistema de busca
    search: {
        // Buscar anotações
        search: function(query, options = {}) {
            const { 
                categoryId = null,
                tags = [],
                includeArchived = false,
                searchFields = ['title', 'content', 'tags']
            } = options;

            if (!query || query.length < AnnotationsSystem.config.searchMinLength) {
                throw new Error(`Consulta deve ter pelo menos ${AnnotationsSystem.config.searchMinLength} caracteres`);
            }

            const searchTerm = query.toLowerCase().trim();
            let notes = Array.from(AnnotationsSystem.storage.notes.values());

            // Aplicar filtros básicos
            if (!includeArchived) {
                notes = notes.filter(note => !note.isArchived);
            }

            if (categoryId !== null) {
                notes = notes.filter(note => note.categoryId === categoryId);
            }

            if (tags.length > 0) {
                notes = notes.filter(note => 
                    tags.some(tag => note.tags.includes(tag))
                );
            }

            // Busca por relevância
            const results = notes.map(note => {
                let score = 0;
                const matches = [];

                if (searchFields.includes('title') && note.title.toLowerCase().includes(searchTerm)) {
                    score += 10;
                    matches.push('title');
                }

                if (searchFields.includes('content') && note.content.toLowerCase().includes(searchTerm)) {
                    score += 5;
                    matches.push('content');
                }

                if (searchFields.includes('tags')) {
                    const tagMatches = note.tags.filter(tag => 
                        tag.toLowerCase().includes(searchTerm)
                    );
                    if (tagMatches.length > 0) {
                        score += tagMatches.length * 3;
                        matches.push('tags');
                    }
                }

                return score > 0 ? { note, score, matches } : null;
            })
            .filter(result => result !== null)
            .sort((a, b) => b.score - a.score);

            return {
                query: searchTerm,
                total: results.length,
                results: results.map(r => ({
                    ...r.note,
                    searchScore: r.score,
                    matchedFields: r.matches
                }))
            };
        },

        // Buscar por tags
        searchByTags: function(tags) {
            if (!Array.isArray(tags) || tags.length === 0) {
                throw new Error('Tags devem ser um array não vazio');
            }

            const notes = Array.from(AnnotationsSystem.storage.notes.values())
                .filter(note => !note.isArchived)
                .filter(note => tags.every(tag => note.tags.includes(tag)));

            return notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        }
    },

    // Sistema de sincronização
    sync: {
        // Sincronizar com servidor (mock)
        syncToServer: async function() {
            // Simular delay de rede
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

            const notes = Array.from(AnnotationsSystem.storage.notes.values());
            const categories = Array.from(AnnotationsSystem.storage.categories.values());

            // Simular sucesso 90% das vezes
            if (Math.random() < 0.9) {
                return {
                    success: true,
                    syncedNotes: notes.length,
                    syncedCategories: categories.length,
                    timestamp: new Date().toISOString()
                };
            } else {
                throw new Error('Falha na sincronização com o servidor');
            }
        },

        // Obter dados do servidor (mock)
        syncFromServer: async function() {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 300));

            // Simular dados do servidor
            const serverData = {
                notes: [
                    {
                        id: 1000,
                        title: 'Nota do Servidor',
                        content: 'Esta nota veio do servidor',
                        categoryId: null,
                        tags: ['servidor', 'sync'],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        isPinned: false,
                        isArchived: false,
                        color: 'blue'
                    }
                ],
                categories: []
            };

            return serverData;
        },

        // Detectar conflitos
        detectConflicts: function(localNotes, serverNotes) {
            const conflicts = [];

            serverNotes.forEach(serverNote => {
                const localNote = localNotes.find(note => note.id === serverNote.id);
                
                if (localNote) {
                    const localDate = new Date(localNote.updatedAt);
                    const serverDate = new Date(serverNote.updatedAt);
                    
                    if (localDate.getTime() !== serverDate.getTime()) {
                        conflicts.push({
                            id: serverNote.id,
                            local: localNote,
                            server: serverNote,
                            type: localDate > serverDate ? 'local_newer' : 'server_newer'
                        });
                    }
                }
            });

            return conflicts;
        }
    },

    // Utilitários
    utils: {
        // Validar dados da anotação
        validateNote: function(noteData) {
            const errors = [];

            if (!noteData.title || noteData.title.trim() === '') {
                errors.push('Título é obrigatório');
            }

            if (!noteData.content || noteData.content.trim() === '') {
                errors.push('Conteúdo é obrigatório');
            }

            if (noteData.title && noteData.title.length > AnnotationsSystem.config.maxTitleLength) {
                errors.push(`Título deve ter no máximo ${AnnotationsSystem.config.maxTitleLength} caracteres`);
            }

            if (noteData.content && noteData.content.length > AnnotationsSystem.config.maxNoteLength) {
                errors.push(`Conteúdo deve ter no máximo ${AnnotationsSystem.config.maxNoteLength} caracteres`);
            }

            if (noteData.tags && !Array.isArray(noteData.tags)) {
                errors.push('Tags devem ser um array');
            }

            return {
                isValid: errors.length === 0,
                errors: errors
            };
        },

        // Extrair tags do texto
        extractTags: function(text) {
            const tagRegex = /#(\w+)/g;
            const tags = [];
            let match;

            while ((match = tagRegex.exec(text)) !== null) {
                tags.push(match[1].toLowerCase());
            }

            return [...new Set(tags)]; // Remove duplicatas
        },

        // Gerar resumo da anotação
        generateSummary: function(content, maxLength = 150) {
            if (!content || content.length <= maxLength) {
                return content;
            }

            const summary = content.substring(0, maxLength);
            const lastSpace = summary.lastIndexOf(' ');
            
            return (lastSpace > 0 ? summary.substring(0, lastSpace) : summary) + '...';
        },

        // Exportar dados
        exportData: function(format = 'json') {
            const data = {
                notes: Array.from(AnnotationsSystem.storage.notes.values()),
                categories: Array.from(AnnotationsSystem.storage.categories.values()),
                tags: Array.from(AnnotationsSystem.storage.tags),
                exportedAt: new Date().toISOString(),
                version: '1.0'
            };

            if (format === 'json') {
                return JSON.stringify(data, null, 2);
            } else if (format === 'csv') {
                // Implementação básica de CSV
                const csvLines = ['ID,Title,Content,Category,Tags,Created,Updated'];
                
                data.notes.forEach(note => {
                    const line = [
                        note.id,
                        `"${note.title.replace(/"/g, '""')}"`,
                        `"${note.content.replace(/"/g, '""')}"`,
                        note.categoryId || '',
                        `"${note.tags.join(', ')}"`,
                        note.createdAt,
                        note.updatedAt
                    ].join(',');
                    csvLines.push(line);
                });

                return csvLines.join('\n');
            }

            throw new Error(`Formato de exportação não suportado: ${format}`);
        },

        // Importar dados
        importData: function(data) {
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (error) {
                    throw new Error('Dados de importação inválidos (JSON malformado)');
                }
            }

            if (!data.notes || !Array.isArray(data.notes)) {
                throw new Error('Dados de importação inválidos (faltando array de notas)');
            }

            const imported = { notes: 0, categories: 0, errors: [] };

            // Importar categorias primeiro
            if (data.categories && Array.isArray(data.categories)) {
                data.categories.forEach(category => {
                    try {
                        if (!AnnotationsSystem.storage.categories.has(category.id)) {
                            AnnotationsSystem.storage.categories.set(category.id, category);
                            imported.categories++;
                        }
                    } catch (error) {
                        imported.errors.push(`Categoria ${category.id}: ${error.message}`);
                    }
                });
            }

            // Importar notas
            data.notes.forEach(note => {
                try {
                    const validation = this.validateNote(note);
                    if (!validation.isValid) {
                        throw new Error(validation.errors.join(', '));
                    }

                    if (!AnnotationsSystem.storage.notes.has(note.id)) {
                        AnnotationsSystem.storage.notes.set(note.id, note);
                        
                        // Adicionar tags ao conjunto global
                        if (note.tags) {
                            note.tags.forEach(tag => AnnotationsSystem.storage.tags.add(tag));
                        }
                        
                        imported.notes++;
                        
                        // Atualizar nextId se necessário
                        if (note.id >= AnnotationsSystem.storage.nextId) {
                            AnnotationsSystem.storage.nextId = note.id + 1;
                        }
                    }
                } catch (error) {
                    imported.errors.push(`Nota ${note.id}: ${error.message}`);
                }
            });

            return imported;
        },

        // Limpar dados
        clearAllData: function() {
            AnnotationsSystem.storage.notes.clear();
            AnnotationsSystem.storage.categories.clear();
            AnnotationsSystem.storage.tags.clear();
            AnnotationsSystem.storage.nextId = 1;
            
            return { success: true, message: 'Todos os dados foram removidos' };
        },

        // Obter estatísticas
        getStatistics: function() {
            const notes = Array.from(AnnotationsSystem.storage.notes.values());
            const activeNotes = notes.filter(note => !note.isArchived);
            const archivedNotes = notes.filter(note => note.isArchived);
            const pinnedNotes = notes.filter(note => note.isPinned);
            
            return {
                totalNotes: notes.length,
                activeNotes: activeNotes.length,
                archivedNotes: archivedNotes.length,
                pinnedNotes: pinnedNotes.length,
                totalCategories: AnnotationsSystem.storage.categories.size,
                totalTags: AnnotationsSystem.storage.tags.size,
                oldestNote: notes.length > 0 ? 
                    notes.reduce((oldest, note) => 
                        new Date(note.createdAt) < new Date(oldest.createdAt) ? note : oldest
                    ) : null,
                newestNote: notes.length > 0 ?
                    notes.reduce((newest, note) => 
                        new Date(note.createdAt) > new Date(newest.createdAt) ? note : newest
                    ) : null
            };
        }
    }
};

describe('Sistema de Anotações - Testes Unitários', () => {
    beforeEach(() => {
        // Limpar dados antes de cada teste
        AnnotationsSystem.utils.clearAllData();
    });

    describe('CRUD de Anotações', () => {
        test('deve criar anotação com dados válidos', () => {
            const noteData = {
                title: 'Minha primeira anotação',
                content: 'Este é o conteúdo da anotação',
                tags: ['importante', 'estudo']
            };

            const note = AnnotationsSystem.crud.create(noteData);

            expect(note.id).toBeDefined();
            expect(note.title).toBe('Minha primeira anotação');
            expect(note.content).toBe('Este é o conteúdo da anotação');
            expect(note.tags).toEqual(['importante', 'estudo']);
            expect(note.createdAt).toBeDefined();
            expect(note.updatedAt).toBeDefined();
            expect(note.isPinned).toBe(false);
            expect(note.isArchived).toBe(false);
        });

        test('deve rejeitar criação sem título', () => {
            const noteData = {
                title: '',
                content: 'Conteúdo sem título'
            };

            expect(() => {
                AnnotationsSystem.crud.create(noteData);
            }).toThrow('Título é obrigatório');
        });

        test('deve rejeitar criação sem conteúdo', () => {
            const noteData = {
                title: 'Título sem conteúdo',
                content: ''
            };

            expect(() => {
                AnnotationsSystem.crud.create(noteData);
            }).toThrow('Conteúdo é obrigatório');
        });

        test('deve ler anotação existente', () => {
            const createdNote = AnnotationsSystem.crud.create({
                title: 'Nota de teste',
                content: 'Conteúdo de teste'
            });

            const readNote = AnnotationsSystem.crud.read(createdNote.id);

            expect(readNote).toEqual(createdNote);
        });

        test('deve falhar ao ler anotação inexistente', () => {
            expect(() => {
                AnnotationsSystem.crud.read(999);
            }).toThrow('Anotação com ID 999 não encontrada');
        });

        test('deve atualizar anotação existente', () => {
            const note = AnnotationsSystem.crud.create({
                title: 'Título original',
                content: 'Conteúdo original'
            });

            const updatedNote = AnnotationsSystem.crud.update(note.id, {
                title: 'Título atualizado',
                isPinned: true
            });

            expect(updatedNote.title).toBe('Título atualizado');
            expect(updatedNote.content).toBe('Conteúdo original'); // Não alterado
            expect(updatedNote.isPinned).toBe(true);
            expect(updatedNote.updatedAt).not.toBe(note.updatedAt);
        });

        test('deve deletar anotação existente', () => {
            const note = AnnotationsSystem.crud.create({
                title: 'Nota para deletar',
                content: 'Será deletada'
            });

            const result = AnnotationsSystem.crud.delete(note.id);

            expect(result.success).toBe(true);
            expect(result.deletedNote).toEqual(note);

            expect(() => {
                AnnotationsSystem.crud.read(note.id);
            }).toThrow('não encontrada');
        });

        test('deve listar anotações com paginação', () => {
            // Criar várias anotações
            for (let i = 1; i <= 25; i++) {
                AnnotationsSystem.crud.create({
                    title: `Nota ${i}`,
                    content: `Conteúdo da nota ${i}`
                });
            }

            const firstPage = AnnotationsSystem.crud.list({ page: 1, limit: 10 });

            expect(firstPage.notes).toHaveLength(10);
            expect(firstPage.pagination.total).toBe(25);
            expect(firstPage.pagination.totalPages).toBe(3);
            expect(firstPage.pagination.hasNextPage).toBe(true);
            expect(firstPage.pagination.hasPrevPage).toBe(false);
        });

        test('deve remover duplicatas de tags', () => {
            const note = AnnotationsSystem.crud.create({
                title: 'Nota com tags duplicadas',
                content: 'Conteúdo',
                tags: ['tag1', 'tag2', 'tag1', 'tag3', 'tag2']
            });

            expect(note.tags).toEqual(['tag1', 'tag2', 'tag3']);
        });
    });

    describe('Sistema de Categorias', () => {
        test('deve criar categoria', () => {
            const category = AnnotationsSystem.categories.create('Estudos', 'blue');

            expect(category.id).toBeDefined();
            expect(category.name).toBe('Estudos');
            expect(category.color).toBe('blue');
            expect(category.createdAt).toBeDefined();
        });

        test('deve listar categorias', () => {
            AnnotationsSystem.categories.create('Categoria A');
            AnnotationsSystem.categories.create('Categoria B');

            const categories = AnnotationsSystem.categories.list();

            expect(categories).toHaveLength(2);
            expect(categories[0].name).toBe('Categoria A'); // Ordenado alfabeticamente
        });

        test('deve contar notas em cada categoria', () => {
            const category = AnnotationsSystem.categories.create('Teste');
            
            AnnotationsSystem.crud.create({
                title: 'Nota 1',
                content: 'Conteúdo 1',
                categoryId: category.id
            });

            const categories = AnnotationsSystem.categories.list();
            const testCategory = categories.find(c => c.id === category.id);

            expect(testCategory.notesCount).toBe(1);
        });

        test('deve impedir deletar categoria com notas', () => {
            const category = AnnotationsSystem.categories.create('Categoria com notas');
            
            AnnotationsSystem.crud.create({
                title: 'Nota na categoria',
                content: 'Conteúdo',
                categoryId: category.id
            });

            expect(() => {
                AnnotationsSystem.categories.delete(category.id);
            }).toThrow('Não é possível deletar categoria que contém anotações');
        });
    });

    describe('Sistema de Busca', () => {
        beforeEach(() => {
            // Criar anotações de teste
            AnnotationsSystem.crud.create({
                title: 'JavaScript Básico',
                content: 'Conceitos fundamentais de JavaScript para iniciantes',
                tags: ['javascript', 'programação', 'básico']
            });

            AnnotationsSystem.crud.create({
                title: 'React Avançado',
                content: 'Hooks, Context API e padrões avançados em React',
                tags: ['react', 'javascript', 'avançado']
            });

            AnnotationsSystem.crud.create({
                title: 'CSS Grid Layout',
                content: 'Como usar CSS Grid para layouts responsivos',
                tags: ['css', 'layout', 'web']
            });
        });

        test('deve buscar por termo no título', () => {
            const results = AnnotationsSystem.search.search('JavaScript');

            expect(results.total).toBe(2); // JavaScript Básico e React Avançado
            expect(results.results[0].title).toContain('JavaScript');
        });

        test('deve buscar por termo no conteúdo', () => {
            const results = AnnotationsSystem.search.search('React');

            expect(results.total).toBe(1);
            expect(results.results[0].title).toBe('React Avançado');
        });

        test('deve buscar por tags', () => {
            const results = AnnotationsSystem.search.search('javascript');

            expect(results.total).toBe(2);
        });

        test('deve rejeitar busca com termo muito curto', () => {
            expect(() => {
                AnnotationsSystem.search.search('ab');
            }).toThrow('Consulta deve ter pelo menos 3 caracteres');
        });

        test('deve buscar especificamente por tags', () => {
            const results = AnnotationsSystem.search.searchByTags(['javascript']);

            expect(results).toHaveLength(2);
            expect(results.every(note => note.tags.includes('javascript'))).toBe(true);
        });

        test('deve ordenar resultados por relevância', () => {
            const results = AnnotationsSystem.search.search('javascript');

            // Resultado com JavaScript no título deve vir primeiro (maior score)
            expect(results.results[0].searchScore).toBeGreaterThan(results.results[1].searchScore);
        });
    });

    describe('Sistema de Sincronização', () => {
        test('deve sincronizar com servidor', async () => {
            // Criar algumas anotações
            AnnotationsSystem.crud.create({
                title: 'Nota para sincronizar',
                content: 'Conteúdo'
            });

            const result = await AnnotationsSystem.sync.syncToServer();

            expect(result.success).toBe(true);
            expect(result.syncedNotes).toBe(1);
            expect(result.timestamp).toBeDefined();
        });

        test('deve tratar falha na sincronização', async () => {
            // Mock para forçar falha
            const originalRandom = Math.random;
            Math.random = () => 0.95; // > 0.9, vai falhar

            await expect(
                AnnotationsSystem.sync.syncToServer()
            ).rejects.toThrow('Falha na sincronização');

            // Restaurar Math.random
            Math.random = originalRandom;
        });

        test('deve obter dados do servidor', async () => {
            const serverData = await AnnotationsSystem.sync.syncFromServer();

            expect(serverData.notes).toBeDefined();
            expect(serverData.categories).toBeDefined();
            expect(Array.isArray(serverData.notes)).toBe(true);
        });

        test('deve detectar conflitos', () => {
            const localNotes = [
                { id: 1, updatedAt: '2025-01-15T10:00:00Z' }
            ];
            const serverNotes = [
                { id: 1, updatedAt: '2025-01-15T11:00:00Z' }
            ];

            const conflicts = AnnotationsSystem.sync.detectConflicts(localNotes, serverNotes);

            expect(conflicts).toHaveLength(1);
            expect(conflicts[0].type).toBe('server_newer');
        });
    });

    describe('Utilitários', () => {
        test('deve validar dados da anotação', () => {
            const validData = {
                title: 'Título válido',
                content: 'Conteúdo válido',
                tags: ['tag1', 'tag2']
            };

            const result = AnnotationsSystem.utils.validateNote(validData);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('deve detectar dados inválidos', () => {
            const invalidData = {
                title: '',
                content: '',
                tags: 'not-an-array'
            };

            const result = AnnotationsSystem.utils.validateNote(invalidData);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('deve extrair tags do texto', () => {
            const text = 'Este texto tem #javascript e #programação como tags #web';
            const tags = AnnotationsSystem.utils.extractTags(text);

            expect(tags).toEqual(['javascript', 'programação', 'web']);
        });

        test('deve gerar resumo do conteúdo', () => {
            const longContent = 'Este é um texto muito longo que precisa ser resumido porque excede o limite de caracteres estabelecido para o resumo automático da anotação no sistema.';
            
            const summary = AnnotationsSystem.utils.generateSummary(longContent, 50);

            expect(summary.length).toBeLessThanOrEqual(53); // 50 + '...'
            expect(summary).toEndWith('...');
        });

        test('deve exportar dados em JSON', () => {
            AnnotationsSystem.crud.create({
                title: 'Nota para exportar',
                content: 'Conteúdo para exportar'
            });

            const exported = AnnotationsSystem.utils.exportData('json');
            const data = JSON.parse(exported);

            expect(data.notes).toHaveLength(1);
            expect(data.exportedAt).toBeDefined();
            expect(data.version).toBe('1.0');
        });

        test('deve exportar dados em CSV', () => {
            AnnotationsSystem.crud.create({
                title: 'Nota CSV',
                content: 'Conteúdo CSV'
            });

            const csv = AnnotationsSystem.utils.exportData('csv');

            expect(csv).toContain('ID,Title,Content');
            expect(csv).toContain('Nota CSV');
        });

        test('deve importar dados válidos', () => {
            const importData = {
                notes: [
                    {
                        id: 100,
                        title: 'Nota importada',
                        content: 'Conteúdo importado',
                        tags: ['importado'],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        isPinned: false,
                        isArchived: false,
                        color: 'default'
                    }
                ],
                categories: []
            };

            const result = AnnotationsSystem.utils.importData(importData);

            expect(result.notes).toBe(1);
            expect(result.errors).toHaveLength(0);

            const importedNote = AnnotationsSystem.crud.read(100);
            expect(importedNote.title).toBe('Nota importada');
        });

        test('deve obter estatísticas', () => {
            AnnotationsSystem.crud.create({
                title: 'Nota 1',
                content: 'Conteúdo 1'
            });

            AnnotationsSystem.crud.create({
                title: 'Nota 2',
                content: 'Conteúdo 2',
                isPinned: true
            });

            const stats = AnnotationsSystem.utils.getStatistics();

            expect(stats.totalNotes).toBe(2);
            expect(stats.activeNotes).toBe(2);
            expect(stats.archivedNotes).toBe(0);
            expect(stats.pinnedNotes).toBe(1);
            expect(stats.oldestNote).toBeDefined();
            expect(stats.newestNote).toBeDefined();
        });
    });

    describe('Casos de Borda e Tratamento de Erros', () => {
        test('deve lidar com storage vazio', () => {
            const result = AnnotationsSystem.crud.list();

            expect(result.notes).toHaveLength(0);
            expect(result.pagination.total).toBe(0);
        });

        test('deve lidar com ID inválido', () => {
            expect(() => {
                AnnotationsSystem.crud.read('invalid-id');
            }).toThrow('ID da anotação deve ser um número');
        });

        test('deve lidar com dados de atualização inválidos', () => {
            const note = AnnotationsSystem.crud.create({
                title: 'Nota de teste',
                content: 'Conteúdo'
            });

            expect(() => {
                AnnotationsSystem.crud.update(note.id, {
                    title: 'a'.repeat(101) // Excede limite
                });
            }).toThrow('Título deve ter no máximo 100 caracteres');
        });

        test('deve manter integridade dos dados após operações', () => {
            const note1 = AnnotationsSystem.crud.create({
                title: 'Nota 1',
                content: 'Conteúdo 1'
            });

            const note2 = AnnotationsSystem.crud.create({
                title: 'Nota 2',
                content: 'Conteúdo 2'
            });

            // Deletar uma nota não deve afetar a outra
            AnnotationsSystem.crud.delete(note1.id);

            const remainingNote = AnnotationsSystem.crud.read(note2.id);
            expect(remainingNote.title).toBe('Nota 2');
        });
    });
});
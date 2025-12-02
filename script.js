document.addEventListener('DOMContentLoaded', function() {
    // Состояние приложения
    const state = {
        elements: [],
        nextId: 1
    };

    // DOM элементы
    const treeContainer = document.getElementById('treeContainer');
    const xmlPreview = document.getElementById('xmlPreview');
    const addRootBtn = document.getElementById('addRoot');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const clearBtn = document.getElementById('clearBtn');
    const copyXmlBtn = document.getElementById('copyXml');
    const formatXmlBtn = document.getElementById('formatXml');
    const importModal = document.getElementById('importModal');
    const importConfirm = document.getElementById('importConfirm');
    const importCancel = document.getElementById('importCancel');
    const importXmlText = document.getElementById('importXmlText');
    const fileInput = document.getElementById('fileInput');

    // Инициализация из LocalStorage
    loadFromLocalStorage();

    // Создание корневого элемента
    function createElement(tag = 'element', value = '', isSection = false, parentId = null) {
        const element = {
            id: state.nextId++,
            tag: tag,
            value: value,
            isSection: isSection,
            children: [],
            parentId: parentId
        };
        
        if (parentId) {
            const parent = findElementById(parentId);
            if (parent) {
                parent.children.push(element);
            }
        } else {
            state.elements.push(element);
        }
        
        saveToLocalStorage();
        renderTree();
        return element;
    }

    // Поиск элемента по ID
    function findElementById(id, elements = state.elements) {
        for (const element of elements) {
            if (element.id === id) return element;
            const found = findElementById(id, element.children);
            if (found) return found;
        }
        return null;
    }

    // Удаление элемента
    function deleteElement(id) {
        const removeFromArray = (arr, id) => {
            const index = arr.findIndex(el => el.id === id);
            if (index !== -1) {
                arr.splice(index, 1);
                return true;
            }
            
            for (const element of arr) {
                if (removeFromArray(element.children, id)) {
                    return true;
                }
            }
            
            return false;
        };
        
        removeFromArray(state.elements, id);
        saveToLocalStorage();
        renderTree();
    }

    // Рендеринг дерева
    function renderTree() {
        treeContainer.innerHTML = '';
        
        if (state.elements.length === 0) {
            treeContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open" style="font-size: 48px; color: var(--text-secondary); margin-bottom: 20px;"></i>
                    <p style="color: var(--text-secondary); text-align: center;">Добавьте корневой элемент, чтобы начать</p>
                </div>
            `;
            return;
        }
        
        state.elements.forEach(element => renderElement(element, treeContainer));
        
        // Обновляем превью
        updateXmlPreview();
    }

    // Рендеринг одного элемента
    function renderElement(element, container, level = 0) {
        const elementDiv = document.createElement('div');
        elementDiv.className = 'xml-element';
        elementDiv.dataset.id = element.id;
        elementDiv.draggable = true;
        
        let contentHTML = `
            <div class="element-content">
                <div class="element-tag" contenteditable="true" data-field="tag">${escapeHtml(element.tag)}</div>
        `;
        
        if (element.isSection) {
            contentHTML += `<div class="element-value" contenteditable="false" style="color: var(--text-secondary);">(раздел)</div>`;
        } else {
            contentHTML += `<span style="color: var(--text-secondary);">:</span>
                           <div class="element-value" contenteditable="true" data-field="value">${escapeHtml(element.value)}</div>`;
        }
        
        contentHTML += `
                <div class="element-actions">
                    <button class="action-btn add-btn" title="Добавить тег">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="action-btn add-section-btn" title="Добавить раздел">
                        <i class="fas fa-folder-plus"></i>
                    </button>
                    <button class="action-btn delete-btn" title="Удалить">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
        
        elementDiv.innerHTML = contentHTML;
        container.appendChild(elementDiv);
        
        // Обработчики событий для кнопок
        const addBtn = elementDiv.querySelector('.add-btn');
        const addSectionBtn = elementDiv.querySelector('.add-section-btn');
        const deleteBtn = elementDiv.querySelector('.delete-btn');
        const tagField = elementDiv.querySelector('[data-field="tag"]');
        const valueField = elementDiv.querySelector('[data-field="value"]');
        
        addBtn.addEventListener('click', () => {
            createElement('новый_тег', '', false, element.id);
        });
        
        addSectionBtn.addEventListener('click', () => {
            createElement('новый_раздел', '', true, element.id);
        });
        
        deleteBtn.addEventListener('click', () => {
            if (confirm('Удалить этот элемент?')) {
                deleteElement(element.id);
            }
        });
        
        // Редактирование тега
        tagField.addEventListener('blur', () => {
            element.tag = tagField.textContent.trim() || 'тег';
            saveToLocalStorage();
            updateXmlPreview();
        });
        
        tagField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                tagField.blur();
            }
        });
        
        // Редактирование значения
        if (valueField) {
            valueField.addEventListener('blur', () => {
                element.value = valueField.textContent.trim();
                saveToLocalStorage();
                updateXmlPreview();
            });
            
            valueField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    valueField.blur();
                }
            });
        }
        
        // Drag & Drop
        elementDiv.addEventListener('dragstart', handleDragStart);
        elementDiv.addEventListener('dragover', handleDragOver);
        elementDiv.addEventListener('drop', handleDrop);
        elementDiv.addEventListener('dragend', handleDragEnd);
        
        // Рендеринг дочерних элементов
        if (element.children.length > 0) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'children';
            elementDiv.appendChild(childrenDiv);
            
            element.children.forEach(child => {
                renderElement(child, childrenDiv, level + 1);
            });
        }
    }

    // Генерация XML
    function generateXml(element, indent = 0) {
        const indentStr = '  '.repeat(indent);
        
        if (element.isSection) {
            let xml = `${indentStr}<${element.tag}>\n`;
            
            if (element.value) {
                xml += `${indentStr}  ${escapeXml(element.value)}\n`;
            }
            
            element.children.forEach(child => {
                xml += generateXml(child, indent + 1);
            });
            
            xml += `${indentStr}</${element.tag}>\n`;
            return xml;
        } else {
            return `${indentStr}<${element.tag}>${escapeXml(element.value)}</${element.tag}>\n`;
        }
    }

    // Обновление превью XML
    function updateXmlPreview() {
        if (state.elements.length === 0) {
            xmlPreview.innerHTML = '<code>&lt;!-- Добавьте элементы для генерации XML --&gt;</code>';
            return;
        }
        
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<root>\n';
        
        state.elements.forEach(element => {
            xml += generateXml(element, 1);
        });
        
        xml += '</root>';
        xmlPreview.textContent = xml;
        
        // Подсветка синтаксиса (простая)
        highlightXml();
    }

    // Простая подсветка XML
    function highlightXml() {
        const code = xmlPreview.textContent;
        let highlighted = code
            .replace(/&lt;(\/?)([\wа-яА-Я_\-]+)&gt;/g, '<span style="color: #569cd6;">&lt;$1$2&gt;</span>')
            .replace(/&lt;!--(.*?)--&gt;/g, '<span style="color: #57a64a;">&lt;!--$1--&gt;</span>')
            .replace(/&quot;(.*?)&quot;/g, '<span style="color: #ce9178;">&quot;$1&quot;</span>')
            .replace(/&apos;(.*?)&apos;/g, '<span style="color: #ce9178;">&apos;$1&apos;</span>')
            .replace(/&lt;\?xml(.*?)\?&gt;/g, '<span style="color: #808080;">&lt;?xml$1?&gt;</span>');
        
        xmlPreview.innerHTML = highlighted;
    }

    // Drag & Drop функции
    let draggedElement = null;

    function handleDragStart(e) {
        draggedElement = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.classList.add('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        
        if (draggedElement !== this) {
            // Простая реализация - можно расширить для изменения структуры дерева
            const temp = draggedElement.innerHTML;
            draggedElement.innerHTML = this.innerHTML;
            this.innerHTML = temp;
            
            // Здесь можно добавить логику обновления state
        }
    }

    function handleDragEnd() {
        this.classList.remove('dragging');
        document.querySelectorAll('.xml-element').forEach(el => {
            el.classList.remove('drag-over');
        });
    }

    // Сохранение в LocalStorage
    function saveToLocalStorage() {
        localStorage.setItem('xmlGeneratorState', JSON.stringify({
            elements: state.elements,
            nextId: state.nextId
        }));
    }

    // Загрузка из LocalStorage
    function loadFromLocalStorage() {
        const saved = localStorage.getItem('xmlGeneratorState');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                state.elements = data.elements || [];
                state.nextId = data.nextId || 1;
                renderTree();
            } catch (e) {
                console.error('Ошибка загрузки из LocalStorage:', e);
            }
        }
    }

    // Вспомогательные функции
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeXml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // Обработчики событий кнопок
    addRootBtn.addEventListener('click', () => {
        createElement('main', '', true);
    });

    exportBtn.addEventListener('click', () => {
        const xml = xmlPreview.textContent;
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'generated.xml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    importBtn.addEventListener('click', () => {
        importModal.style.display = 'flex';
        importXmlText.focus();
    });

    clearBtn.addEventListener('click', () => {
        if (confirm('Очистить все элементы? Это действие нельзя отменить.')) {
            state.elements = [];
            state.nextId = 1;
            saveToLocalStorage();
            renderTree();
        }
    });

    copyXmlBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(xmlPreview.textContent);
            copyXmlBtn.innerHTML = '<i class="fas fa-check"></i> Скопировано!';
            setTimeout(() => {
                copyXmlBtn.innerHTML = '<i class="fas fa-copy"></i> Копировать';
            }, 2000);
        } catch (err) {
            console.error('Ошибка копирования:', err);
            alert('Не удалось скопировать XML');
        }
    });

    formatXmlBtn.addEventListener('click', () => {
        updateXmlPreview(); // Просто перерисовываем
    });

    importConfirm.addEventListener('click', () => {
        const xmlText = importXmlText.value.trim();
        if (xmlText) {
            // Простой парсинг XML (можно улучшить)
            try {
                // Очищаем текущее состояние
                state.elements = [];
                state.nextId = 1;
                
                // Парсим XML (упрощенная версия)
                parseXml(xmlText);
                
                saveToLocalStorage();
                renderTree();
                importModal.style.display = 'none';
                importXmlText.value = '';
            } catch (e) {
                alert('Ошибка парсинга XML: ' + e.message);
            }
        }
    });

    importCancel.addEventListener('click', () => {
        importModal.style.display = 'none';
        importXmlText.value = '';
    });

    // Простой парсер XML (базовый)
    function parseXml(xmlString) {
        // Удаляем декларацию XML
        xmlString = xmlString.replace(/<\?xml.*?\?>/g, '');
        
        // Удаляем комментарии
        xmlString = xmlString.replace(/<!--.*?-->/gs, '');
        
        // Ищем корневой элемент
        const rootMatch = xmlString.match(/<(\w+)>([\s\S]*)<\/\1>/);
        if (!rootMatch) {
            throw new Error('Корневой элемент не найден');
        }
        
        const rootTag = rootMatch[1];
        const rootContent = rootMatch[2];
        
        // Создаем корневой элемент
        const rootElement = createElement(rootTag, '', true);
        
        // Рекурсивно парсим содержимое
        parseXmlContent(rootContent, rootElement.id);
    }

    function parseXmlContent(content, parentId) {
        const tagRegex = /<(\w+)>([^<]*)<\/\1>|<(\w+)>([\s\S]*?)<\/\3>/g;
        let match;
        
        while ((match = tagRegex.exec(content)) !== null) {
            const tag = match[1] || match[3];
            const value = match[2] || match[4];
            
            // Проверяем, содержит ли значение вложенные теги
            const hasNestedTags = /<(\w+)>/.test(value);
            
            if (hasNestedTags) {
                const element = createElement(tag, '', true, parentId);
                parseXmlContent(value, element.id);
            } else {
                createElement(tag, value.trim(), false, parentId);
            }
        }
    }

    // Горячие клавиши
    document.addEventListener('keydown', (e) => {
        // Ctrl + S для сохранения
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            exportBtn.click();
        }
        
        // Escape для закрытия модального окна
        if (e.key === 'Escape' && importModal.style.display === 'flex') {
            importModal.style.display = 'none';
        }
    });

    // Закрытие модального окна при клике вне его
    importModal.addEventListener('click', (e) => {
        if (e.target === importModal) {
            importModal.style.display = 'none';
        }
    });

    // Инициализация начального состояния
    if (state.elements.length === 0) {
        // Создаем пример структуры
        const root = createElement('main', '', true);
        createElement('project', 'RTS', false, root.id);
        const meta = createElement('meta', '', true, root.id);
        createElement('version', '1.0.0', false, meta.id);
        createElement('author', 'Ya', false, meta.id);
    }
});

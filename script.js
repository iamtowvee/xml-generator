document.addEventListener('DOMContentLoaded', function() {
    const state = {
        elements: [],
        nextId: 1
    };

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

    loadFromLocalStorage();

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

    function findElementById(id, elements = state.elements) {
        for (const element of elements) {
            if (element.id === id) return element;
            const found = findElementById(id, element.children);
            if (found) return found;
        }
        return null;
    }

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

    function renderTree() {
        treeContainer.innerHTML = '';
        
        if (state.elements.length === 0) {
            treeContainer.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i class="fas fa-folder-open" style="font-size: 48px; margin-bottom: 20px;"></i>
                    <p>Добавьте корневой элемент, чтобы начать</p>
                </div>
            `;
            return;
        }
        
        state.elements.forEach(element => renderElement(element, treeContainer));
        updateXmlPreview();
    }

    function renderElement(element, container, level = 0) {
        const elementDiv = document.createElement('div');
        elementDiv.className = 'xml-element';
        elementDiv.dataset.id = element.id;
        
        let contentHTML = `
            <div class="element-content">
                <div class="element-tag" contenteditable="true" data-field="tag">${escapeHtml(element.tag)}</div>
        `;
        
        if (element.isSection) {
            contentHTML += `
                <span style="color: var(--text-secondary);">:</span>
                <div class="element-value" contenteditable="true" data-field="value" placeholder="значение (опционально)">${escapeHtml(element.value)}</div>
                <span class="hint" style="margin-left: 5px;">(раздел)</span>
            `;
        } else {
            contentHTML += `
                <span style="color: var(--text-secondary);">:</span>
                <div class="element-value" contenteditable="true" data-field="value">${escapeHtml(element.value)}</div>
            `;
        }
        
        contentHTML += `
                <div class="element-actions">
                    <button class="action-btn add-btn" title="Добавить обычный тег">
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
        
        const addBtn = elementDiv.querySelector('.add-btn');
        const addSectionBtn = elementDiv.querySelector('.add-section-btn');
        const deleteBtn = elementDiv.querySelector('.delete-btn');
        const tagField = elementDiv.querySelector('[data-field="tag"]');
        const valueField = elementDiv.querySelector('[data-field="value"]');
        
        addBtn.addEventListener('click', () => {
            createElement('тег', 'значение', false, element.id);
        });
        
        addSectionBtn.addEventListener('click', () => {
            createElement('раздел', '', true, element.id);
        });
        
        deleteBtn.addEventListener('click', () => {
            if (confirm('Удалить этот элемент?')) {
                deleteElement(element.id);
            }
        });
        
        tagField.addEventListener('blur', () => {
            const newTag = tagField.textContent.trim();
            if (newTag && /^[a-zA-Z_][a-zA-Z0-9_\-\.]*$/.test(newTag)) {
                element.tag = newTag;
            } else {
                tagField.textContent = element.tag;
                alert('Имя тега должно начинаться с буквы и содержать только буквы, цифры, _, -, .');
            }
            saveToLocalStorage();
            updateXmlPreview();
        });
        
        tagField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                tagField.blur();
            }
        });
        
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
        
        if (element.children.length > 0) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'children';
            elementDiv.appendChild(childrenDiv);
            
            element.children.forEach(child => {
                renderElement(child, childrenDiv, level + 1);
            });
        }
    }

    function generateXml(element, indent = 0) {
        const indentStr = '  '.repeat(indent);
        
        if (element.isSection) {
            // Раздел может иметь значение как атрибут или как текст
            let hasChildren = element.children.length > 0;
            let hasValue = element.value && element.value.trim() !== '';
            
            if (!hasChildren && !hasValue) {
                // Пустой тег
                return `${indentStr}<${element.tag} />\n`;
            } else if (!hasChildren && hasValue) {
                // Тег только со значением
                return `${indentStr}<${element.tag}>${escapeXml(element.value)}</${element.tag}>\n`;
            } else if (hasChildren && hasValue) {
                // Тег со значением-атрибутом и детьми
                return `${indentStr}<${element.tag} value="${escapeXml(element.value)}">\n` +
                       element.children.map(child => generateXml(child, indent + 1)).join('') +
                       `${indentStr}</${element.tag}>\n`;
            } else {
                // Тег только с детьми
                return `${indentStr}<${element.tag}>\n` +
                       element.children.map(child => generateXml(child, indent + 1)).join('') +
                       `${indentStr}</${element.tag}>\n`;
            }
        } else {
            // Обычный тег
            return `${indentStr}<${element.tag}>${escapeXml(element.value)}</${element.tag}>\n`;
        }
    }

    function updateXmlPreview() {
        if (state.elements.length === 0) {
            xmlPreview.innerHTML = '<code>&lt;!-- Добавьте элементы для генерации XML --&gt;</code>';
            return;
        }
        
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        
        // Если есть несколько корневых элементов, оборачиваем в root
        if (state.elements.length > 1) {
            xml += '<root>\n';
            state.elements.forEach(element => {
                xml += generateXml(element, 1);
            });
            xml += '</root>';
        } else {
            xml += generateXml(state.elements[0], 0);
        }
        
        xmlPreview.textContent = formatXml(xml);
        highlightXml();
    }

    function formatXml(xml) {
        // Простое форматирование отступов
        let formatted = '';
        let indent = 0;
        let inTag = false;
        
        for (let i = 0; i < xml.length; i++) {
            const char = xml[i];
            const nextChar = xml[i + 1];
            
            if (char === '<' && nextChar === '/') {
                // Закрывающий тег
                indent--;
                formatted += '\n' + '  '.repeat(indent) + char;
            } else if (char === '<') {
                // Открывающий тег
                if (i > 0 && xml[i-1] !== '\n') {
                    formatted += '\n' + '  '.repeat(indent);
                }
                formatted += char;
                if (nextChar !== '?' && nextChar !== '!' && nextChar !== '/') {
                    indent++;
                }
            } else if (char === '>' && nextChar === '<') {
                formatted += char;
            } else {
                formatted += char;
            }
        }
        
        return formatted.trim();
    }

    function highlightXml() {
        const code = xmlPreview.textContent;
        let highlighted = code
            .replace(/&lt;(\/?)([\w\-\.]+)([^>]*?)&gt;/g, '<span style="color: #569cd6;">&lt;$1$2$3&gt;</span>')
            .replace(/&lt;!--(.*?)--&gt;/g, '<span style="color: #57a64a;">&lt;!--$1--&gt;</span>')
            .replace(/&quot;([^&]+)&quot;/g, '<span style="color: #ce9178;">&quot;$1&quot;</span>')
            .replace(/&lt;\?xml([^&]+)\?&gt;/g, '<span style="color: #808080;">&lt;?xml$1?&gt;</span>')
            .replace(/(&lt;\/?[\w\-\.]+&gt;)/g, '<span style="color: #569cd6;">$1</span>');
        
        xmlPreview.innerHTML = highlighted;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeXml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // Сохранение и загрузка
    function saveToLocalStorage() {
        localStorage.setItem('xmlGeneratorState', JSON.stringify({
            elements: state.elements,
            nextId: state.nextId
        }));
    }

    function loadFromLocalStorage() {
        const saved = localStorage.getItem('xmlGeneratorState');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                state.elements = data.elements || [];
                state.nextId = data.nextId || 1;
                renderTree();
            } catch (e) {
                console.error('Ошибка загрузки:', e);
            }
        }
    }

    // Обработчики кнопок
    addRootBtn.addEventListener('click', () => {
        createElement('root', '', true);
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
        if (confirm('Очистить все элементы?')) {
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
        updateXmlPreview();
    });

    importConfirm.addEventListener('click', () => {
        const xmlText = importXmlText.value.trim();
        if (xmlText) {
            try {
                // Создаем пример для демонстрации
                state.elements = [];
                state.nextId = 1;
                
                // Простой парсинг
                parseSimpleXml(xmlText);
                
                saveToLocalStorage();
                renderTree();
                importModal.style.display = 'none';
                importXmlText.value = '';
            } catch (e) {
                alert('Ошибка: ' + e.message);
            }
        }
    });

    importCancel.addEventListener('click', () => {
        importModal.style.display = 'none';
        importXmlText.value = '';
    });

    function parseSimpleXml(xmlString) {
        // Упрощенный парсер для демонстрации
        xmlString = xmlString.replace(/<\?xml.*?\?>/g, '');
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
        
        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            throw new Error('Некорректный XML');
        }
        
        function parseNode(node, parentId = null) {
            const tagName = node.nodeName;
            const isElement = node.nodeType === 1; // ELEMENT_NODE
            const hasChildren = node.childNodes.length > 0;
            const textContent = node.textContent.trim();
            
            if (isElement && tagName !== '#text') {
                const isSection = hasChildren && node.childNodes.length > 1 || 
                                 (hasChildren && node.childNodes[0].nodeType === 1);
                
                const element = createElement(tagName, '', isSection, parentId);
                
                // Добавляем атрибуты как дочерние элементы
                if (node.attributes && node.attributes.length > 0) {
                    for (let attr of node.attributes) {
                        createElement('@' + attr.name, attr.value, false, element.id);
                    }
                }
                
                // Рекурсивно парсим детей
                for (let child of node.childNodes) {
                    parseNode(child, element.id);
                }
                
                // Если есть текст напрямую
                if (textContent && !isSection) {
                    element.value = textContent;
                }
            }
        }
        
        parseNode(xmlDoc.documentElement);
    }

    // Горячие клавиши
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            exportBtn.click();
        }
        
        if (e.key === 'Escape' && importModal.style.display === 'flex') {
            importModal.style.display = 'none';
        }
    });

    importModal.addEventListener('click', (e) => {
        if (e.target === importModal) {
            importModal.style.display = 'none';
        }
    });

    // Инициализация с примером
    if (state.elements.length === 0) {
        const root = createElement('main', '', true);
        createElement('project', 'RTS', false, root.id);
        const meta = createElement('meta', '', true, root.id);
        createElement('version', '1.0.0', false, meta.id);
        createElement('author', 'Ya', false, meta.id);
    }
});

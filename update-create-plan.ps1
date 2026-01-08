# PowerShell script to update create_plan validation and execution in toolsService.ts

$filePath = "src\vs\workbench\contrib\void\browser\toolsService.ts"
$content = Get-Content $filePath -Raw

# Update validation (lines 464-483)
$oldValidation = @'
		create_plan: (params: RawToolParamsObj): BuiltinToolCallParams['create_plan'] => {
			const planName = validateOptionalStr('plan_name', params.plan_name);
			const overview = validateStr('overview', params.overview);
			let initialFiles: string[] = [];

			if (params.initial_files) {
				if (typeof params.initial_files === 'string') {
					try {
						initialFiles = JSON.parse(params.initial_files);
					} catch {
						// If it's not JSON, try to parse as comma-separated
						initialFiles = params.initial_files.split(',').map((s: string) => s.trim()).filter(Boolean);
					}
				} else if (Array.isArray(params.initial_files)) {
					initialFiles = params.initial_files;
				}
			}

			return { planName, overview, initialFiles };
		},
'@

$newValidation = @'
		create_plan: (params: RawToolParamsObj): BuiltinToolCallParams['create_plan'] => {
			const name = validateOptionalStr('name', params.name);
			const overview = validateStr('overview', params.overview);
			const plan = validateStr('plan', params.plan);
			let todos: TodoItem[] = [];

			if (params.todos) {
				if (typeof params.todos === 'string') {
					try {
						todos = JSON.parse(params.todos);
					} catch (e) {
						throw new Error(`Invalid todos parameter: must be valid JSON array. ${e}`);
					}
				} else if (Array.isArray(params.todos)) {
					todos = params.todos;
				}

				// Validate todo structure
				if (!Array.isArray(todos)) {
					throw new Error('Todos must be an array');
				}
				for (const todo of todos) {
					if (!todo.id || typeof todo.id !== 'string') {
						throw new Error('Each todo must have an "id" field (string)');
					}
					if (!todo.content || typeof todo.content !== 'string') {
						throw new Error('Each todo must have a "content" field (string)');
					}
				}
			}

			return { name, overview, plan, todos };
		},
'@

# Update execution (lines 1049-1107)
$oldExecution = @'
		create_plan: async (params: BuiltinToolCallParams['create_plan']) => {
			const { planName, overview, initialFiles } = params;

			// Get workspace folders
			const folders = workspaceContextService.getWorkspace().folders;
			if (folders.length === 0) {
				throw new Error('No workspace folder open. Please open a folder to create a plan.');
			}

			const workspaceRoot = folders[0].uri;

			// Ensure .void/plans directory exists
			const plansDirUri = URI.joinPath(workspaceRoot, this._planDir);
			try {
				await fileService.createFolder(plansDirUri);
			} catch {
				// Folder might already exist, which is fine
			}

			// Generate filename and create plan content
			const effectivePlanName = planName || 'Implementation Plan';
			const fileName = generatePlanFileName(effectivePlanName);
			const planUri = URI.joinPath(plansDirUri, fileName);

			const planContent = createPlanContent({
				planName: effectivePlanName,
				overview,
				initialFiles,
				metadata: {
					title: effectivePlanName,
					created: new Date().toISOString(),
					updated: new Date().toISOString(),
					status: 'planning',
					model: this.voidSettingsService.state.modelSelectionOfFeature.Chat?.modelName,
				},
			});

			// Write the plan file
			await fileService.writeFile(planUri, VSBuffer.fromString(planContent));

			// Set as active plan
			this._activePlanPath = planUri.fsPath;

			// Open the plan file in the editor
			await this.commandService.executeCommand('vscode.open', planUri);

			// Capture metrics
			this._metricsService.capture('Create Plan', {
				planName: effectivePlanName,
				initialFilesCount: initialFiles.length,
			});

			return {
				result: {
					planPath: planUri.fsPath,
					planName: effectivePlanName,
				}
			};
		},
'@

$newExecution = @'
		create_plan: async (params: BuiltinToolCallParams['create_plan']) => {
			const { name, overview, plan, todos } = params;

			// Get workspace folders
			const folders = workspaceContextService.getWorkspace().folders;
			if (folders.length === 0) {
				throw new Error('No workspace folder open. Please open a folder to create a plan.');
			}

			const workspaceRoot = folders[0].uri;

			// Ensure .void/plans directory exists
			const plansDirUri = URI.joinPath(workspaceRoot, this._planDir);
			try {
				await fileService.createFolder(plansDirUri);
			} catch {
				// Folder might already exist, which is fine
			}

			// Generate filename with effective name
			const effectiveName = name || 'Implementation Plan';
			const fileName = generatePlanFileName(effectiveName);
			const planUri = URI.joinPath(plansDirUri, fileName);

			// Use atomic plan content generator (Cursor AI style)
			const planContent = createAtomicPlanContent({
				name: effectiveName,
				overview,
				plan,
				todos,
				metadata: {
					title: effectiveName,
					created: new Date().toISOString(),
					updated: new Date().toISOString(),
					status: 'planning',
					model: this.voidSettingsService.state.modelSelectionOfFeature.Chat?.modelName,
				},
			});

			// Write the plan file
			await fileService.writeFile(planUri, VSBuffer.fromString(planContent));

			// Set as active plan
			this._activePlanPath = planUri.fsPath;

			// Open the plan file in the editor
			await this.commandService.executeCommand('vscode.open', planUri);

			// Capture metrics
			this._metricsService.capture('Create Plan', {
				planName: effectiveName,
				todosCount: todos.length,
			});

			return {
				result: {
					planPath: planUri.fsPath,
					planName: effectiveName,
				}
			};
		},
'@

# Apply replacements
$content = $content.Replace($oldValidation, $newValidation)
$content = $content.Replace($oldExecution, $newExecution)

# Write back to file
Set-Content -Path $filePath -Value $content -NoNewline

Write-Host "Successfully updated toolsService.ts"
Write-Host "- Updated create_plan validation (params: name, overview, plan, todos)"
Write-Host "- Updated create_plan execution (uses createAtomicPlanContent)"

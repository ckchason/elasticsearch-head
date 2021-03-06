(function( app, i18n ) {

	var ui = app.ns("ui");

	ui.NodesView = ui.AbstractWidget.extend({
		default: {
			interactive: true,
			cluster: null,
			data: null
		},
		init: function() {
			this._super();
			this.interactive = this.config.interactive;
			this.cluster = this.config.cluster;
			this.el = $( this._main_template( this.config.data.cluster, this.config.data.indices ) );
		},

		_newAliasAction_handler: function( index ) {
			var fields = new app.ux.FieldCollection({
				fields: [
					new ui.TextField({ label: i18n.text("AliasForm.AliasName"), name: "alias", require: true })
				]
			});
			var dialog = new ui.DialogPanel({
				title: i18n.text("AliasForm.NewAliasForIndexName", index.name),
				body: new ui.PanelForm({ fields: fields }),
				onCommit: function(panel, args) {
					if(fields.validate()) {
						var data = fields.getData();
						var command = {
							"actions" : [
								{ "add" : { "index" : index.name, "alias" : data["alias"] } }
							]
						};
						this.config.cluster.post('_aliases', JSON.stringify(command), function(d) {
							dialog.close();
							alert(JSON.stringify(d));
							this.fire("redraw");
						}.bind(this) );
					}
				}.bind(this)
			}).open();
		},
		_postIndexAction_handler: function(action, index, redraw) {
			this.cluster.post(index.name + "/" + action, null, function(r) {
				alert(JSON.stringify(r));
				redraw && this.fire("redraw");
			}.bind(this));
		},
		_testAnalyser_handler: function(index) {
			this.cluster.get(index.name + "/_analyze?text=" + prompt( i18n.text("IndexCommand.TextToAnalyze") ), function(r) {
				alert(JSON.stringify(r, true, "  "));
			});
		},
		_deleteIndexAction_handler: function(index) {
			if( prompt( i18n.text("AliasForm.DeleteAliasMessage", i18n.text("Command.DELETE"), index.name ) ) === i18n.text("Command.DELETE") ) {
				this.cluster["delete"](index.name, null, function(r) {
					alert(JSON.stringify(r));
					this.fire("redraw");
				}.bind(this) );
			}
		},
		_shutdownNode_handler: function(node) {
			if(prompt( i18n.text("IndexCommand.ShutdownMessage", i18n.text("Command.SHUTDOWN"), node.cluster.name ) ) === i18n.text("Command.SHUTDOWN") ) {
				this.cluster.post( "_cluster/nodes/" + node.name + "/_shutdown", null, function(r) {
					alert(JSON.stringify(r));
					this.fire("redraw");
				}.bind(this));
			}
		},
		_deleteAliasAction_handler: function( index, alias ) {
			if( confirm( i18n.text("Command.DeleteAliasMessage" ) ) ) {
				var command = {
					"actions" : [
						{ "remove" : { "index" : index.name, "alias" : alias.name } }
					]
				};
				this.config.cluster.post('_aliases', JSON.stringify(command), function(d) {
					alert(JSON.stringify(d));
					this.fire("redraw");
				}.bind(this) );
			}
		},

		_replica_template: function(replica) {
			var r = replica.replica;
			return { tag: "DIV",
				cls: "uiNodesView-replica" + (r.primary ? " primary" : "") + ( " state-" + r.state ),
				text: r.shard.toString(),
				onclick: function() { new ui.JsonPanel({
					json: replica.status || r,
					title: r.index + "/" + r.node + " [" + r.shard + "]" });
				}
			};
		},
		_routing_template: function(routing) {
			var cell = { tag: "TD", cls: "uiNodesView-routing" + (routing.open ? "" : " close"), children: [] };
			for(var i = 0; i < routing.replicas.length; i++) {
				if(i % routing.max_number_of_shards === 0 && i > 0) {
					cell.children.push({ tag: "BR" });
				}
				if( routing.replicas[i] ) {
					cell.children.push(this._replica_template(routing.replicas[i]));
				} else {
					cell.children.push( { tag: "DIV", cls: "uiNodesView-nullReplica" } );
				}
			}
			return cell;
		},
		_nodeControls_template: function( node ) { return (
			{ tag: "DIV", cls: "uiNodesView-controls", children: [
				new ui.MenuButton({
					label: i18n.text("NodeInfoMenu.Title"),
					menu: new ui.MenuPanel({
						items: [
							{ text: i18n.text("NodeInfoMenu.ClusterNodeInfo"), onclick: function() { new ui.JsonPanel({ json: node.cluster, title: node.name });} },
							{ text: i18n.text("NodeInfoMenu.NodeStats"), onclick: function() { new ui.JsonPanel({ json: node.stats, title: node.name });} }
						]
					})
				}),
				new ui.MenuButton({
					label: i18n.text("NodeActionsMenu.Title"),
					menu: new ui.MenuPanel({
						items: [
							{ text: i18n.text("NodeActionsMenu.Shutdown"), onclick: function() { this._shutdownNode_handler(node); }.bind(this) }
						]
					})
				})
			] }
		); },
		_node_template: function(node) {
			return { tag: "TR", cls: "uiNodesView-node" + (node.master_node ? " master": ""), children: [
				{ tag: "TH", children: node.name === "Unassigned" ? [
					{ tag: "DIV", cls: "uiNodesView-title", text: node.name }
				] : [
					{ tag: "DIV", children: [
						{ tag: "SPAN", cls: "uiNodesView-title", text: node.cluster.name },
						" ",
						{ tag: "SPAN", text: node.name }
					]},
					{ tag: "DIV", text: node.cluster.http_address },
					this.interactive ? this._nodeControls_template( node ) : null
				] }
			].concat(node.routings.map(this._routing_template, this))};
		},
		_alias_template: function(alias, row) {
			return { tag: "TR", children: [ { tag: "TD" } ].concat(alias.indices.map(function(index, i) {
				if (index) {
					return {
						tag: "TD",
						css: { background: "#" + "9ce9c7fc9".substr((row+6)%7,3) },
						cls: "uiNodesView-hasAlias" + ( alias.min === i ? " min" : "" ) + ( alias.max === i ? " max" : "" ),
						text: alias.name,
						children: this.interactive ? [
							{	tag: 'SPAN',
								text: i18n.text("General.CloseGlyph"),
								cls: 'uiNodesView-hasAlias-remove',
								onclick: this._deleteAliasAction_handler.bind( this, index, alias )
							}
						]: null
					};
				}
				else {
					return { tag: "TD" };
				}
			},
			this)) };
		},
		_indexHeaderControls_template: function( index ) { return (
			{ tag: "DIV", cls: "uiNodesView-controls", children: [
				new ui.MenuButton({
					label: i18n.text("IndexInfoMenu.Title"),
					menu: new ui.MenuPanel({
						items: [
							{ text: i18n.text("IndexInfoMenu.Status"), onclick: function() { new ui.JsonPanel({ json: index.status, title: index.name }); } },
							{ text: i18n.text("IndexInfoMenu.Metadata"), onclick: function() { new ui.JsonPanel({ json: index.metadata, title: index.name }); } }
						]
					})
				}),
				new ui.MenuButton({
					label: i18n.text("IndexActionsMenu.Title"),
					menu: new ui.MenuPanel({
						items: [
							{ text: i18n.text("IndexActionsMenu.NewAlias"), onclick: function() { this._newAliasAction_handler(index); }.bind(this) },
							{ text: i18n.text("IndexActionsMenu.Refresh"), onclick: function() { this._postIndexAction_handler("_refresh", index, false); }.bind(this) },
							{ text: i18n.text("IndexActionsMenu.Flush"), onclick: function() { this._postIndexAction_handler("_flush", index, false); }.bind(this) },
							{ text: i18n.text("IndexActionsMenu.Snapshot"), disabled: closed, onclick: function() { this._postIndexAction_handler("_gateway/snapshot", index, false); }.bind(this) },
							{ text: i18n.text("IndexActionsMenu.Analyser"), onclick: function() { this._testAnalyser_handler(index); }.bind(this) },
							{ text: (index.state === "close") ? i18n.text("IndexActionsMenu.Open") : i18n.text("IndexActionsMenu.Close"), onclick: function() { this._postIndexAction_handler((index.state === "close") ? "_open" : "_close", index, true); }.bind(this) },
							{ text: i18n.text("IndexActionsMenu.Delete"), onclick: function() { this._deleteIndexAction_handler(index); }.bind(this) }
						]
					})
				})
			] }
		); },
		_indexHeader_template: function( index ) {
			var closed = index.state === "close";
			var line1 = closed ? "index: close" : ( "size: " + (index.status && index.status.index ? index.status.index.primary_size + " (" + index.status.index.size + ")" : "unknown" ) ); 
			var line2 = closed ? "\u00A0" : ( "docs: " + (index.status && index.status.docs ? index.status.docs.num_docs.toLocaleString() + " (" + index.status.docs.max_doc.toLocaleString() + ")" : "unknown" ) );
			return index.name ? { tag: "TH", cls: (closed ? "close" : ""), children: [
				{ tag: "DIV", cls: "uiNodesView-title", text: index.name },
				{ tag: "DIV", text: line1 },
				{ tag: "DIV", text: line2 },
				this.interactive ? this._indexHeaderControls_template( index ) : null
			] } : { tag: "TH" };
		},
		_main_template: function(cluster, indices) {
			return { tag: "TABLE", cls: "uiNodesView", children: [
				{ tag: "THEAD", child: { tag: "TR", children: indices.map(this._indexHeader_template, this) } },
				cluster.aliases.length && { tag: "TBODY", children: cluster.aliases.map(this._alias_template, this) },
				{ tag: "TBODY", children: cluster.nodes.map(this._node_template, this) }
			] };
		}

	});

})( this.app, this.i18n );
